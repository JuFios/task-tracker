import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Byte-length limit for string inputs whose backend consumer truncates by
 * bytes (bcrypt silently ignores everything past 72 bytes, so two different
 * passwords would hash identically — reject instead of truncating).
 */
export function MaxByteLength(
  bytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxByteLength',
      target: object.constructor,
      propertyName,
      constraints: [bytes],
      options: validationOptions,
      validator: MaxByteLengthConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'maxByteLength', async: false })
class MaxByteLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    return (
      typeof value === 'string' &&
      Buffer.byteLength(value, 'utf8') <= (args.constraints[0] as number)
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be at most ${args.constraints[0]} bytes (UTF-8)`;
  }
}
