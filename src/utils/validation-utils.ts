import { ValidationError } from '@nestjs/common';

const isObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null;
};

const isValidationError = (object: any): boolean => {
  return 'target' in object;
};

export const subtractExceptionMessage = (validationErrors: ValidationError[]): string => {
  const firstError = validationErrors[0];
  if (firstError && firstError.constraints) {
    const { constraints } = validationErrors[0];

    if (isObject(constraints)) {
      const constraintKeys = Object.keys(constraints);
      if (constraintKeys.length > 0) {
        return constraints[constraintKeys[0]];
      }
    }
  }

  if (!validationErrors?.[0]?.children?.[0]) {
    return;
  }
  const firstChild = validationErrors[0].children[0];
  if (!isObject(firstChild)) {
    return;
  }

  if (isValidationError(firstChild)) {
    return subtractExceptionMessage([firstChild]);
  }
};
