import {
  type RecursiveArray,
  type ReturnTypeFunc,
  type TypeOptions,
  type TypeValue,
  type TypeValueThunk,
} from "@/decorators/types";
import { ensureReflectMetadataExists } from "@/metadata/utils";
import { bannedTypes } from "./returnTypes";

export type MetadataKey = "design:type" | "design:returntype" | "design:paramtypes";

export interface TypeInfo {
  getType: TypeValueThunk;
  typeOptions: TypeOptions;
}

export interface GetTypeParams {
  metadataKey: MetadataKey;
  prototype: Object;
  propertyKey: string;
  parameterIndex?: number;
  argName?: string;
  returnTypeFunc?: ReturnTypeFunc;
  typeOptions?: TypeOptions;
}

function findTypeValueArrayDepth(
  [typeValueOrArray]: RecursiveArray<TypeValue>,
  innerDepth = 1,
): { depth: number; returnType: TypeValue } {
  if (!Array.isArray(typeValueOrArray)) {
    return { depth: innerDepth, returnType: typeValueOrArray };
  }
  return findTypeValueArrayDepth(typeValueOrArray, innerDepth + 1);
}

export function findType({
  metadataKey,
  prototype,
  propertyKey,
  parameterIndex,
  argName,
  returnTypeFunc,
  typeOptions = {},
}: GetTypeParams): TypeInfo {
  const options: TypeOptions = { ...typeOptions };
  let metadataDesignType: Function | undefined;
  ensureReflectMetadataExists();
  const reflectedType: Function[] | Function | undefined = Reflect.getMetadata(
    metadataKey,
    prototype,
    propertyKey,
  );
  if (reflectedType) {
    if (metadataKey === "design:paramtypes") {
      metadataDesignType = (reflectedType as Function[])[parameterIndex!];
    } else {
      metadataDesignType = reflectedType as Function;
    }
  }

  if (!returnTypeFunc && (!metadataDesignType || bannedTypes.includes(metadataDesignType))) {
    let errorMessage =
      `Unable to infer GraphQL type from TypeScript reflection system. ` +
      `You need to provide explicit type for `;
    if (argName) {
      errorMessage += `argument named '${argName}' of `;
    } else if (parameterIndex !== undefined) {
      errorMessage += `parameter #${parameterIndex} of `;
    }
    errorMessage += `'${propertyKey}' of '${prototype.constructor.name}' class.`;
    // eslint-disable-next-line no-console
    console.error(errorMessage);
  }

  if (returnTypeFunc) {
    const getType = () => {
      const returnTypeFuncReturnValue = returnTypeFunc();
      if (Array.isArray(returnTypeFuncReturnValue)) {
        const { depth, returnType } = findTypeValueArrayDepth(returnTypeFuncReturnValue);
        options.array = true;
        options.arrayDepth = depth;
        return returnType;
      }
      return returnTypeFuncReturnValue;
    };
    return {
      getType,
      typeOptions: options,
    };
  }
  if (metadataDesignType) {
    return {
      getType: () => metadataDesignType!,
      typeOptions: options,
    };
  }
  throw new Error("Ops... this should never happen :)");
}
