import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'splitPartsValid', async: false })
export class SplitPartsValidator implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as { splitParts?: number; userPart?: number };
    if (obj.splitParts === undefined || obj.userPart === undefined) return true;
    return obj.userPart <= obj.splitParts;
  }

  defaultMessage() {
    return 'userPart must be less than or equal to splitParts';
  }
}
