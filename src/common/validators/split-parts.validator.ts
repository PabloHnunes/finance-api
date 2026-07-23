import { BadRequestException } from '@nestjs/common';
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

/**
 * Checa a regra userPart <= splitParts contra os valores efetivos
 * (após aplicar defaults/valores atuais), cobrindo os casos em que o
 * DTO informa só um dos dois campos e o SplitPartsValidator, que só
 * enxerga o payload, não tem como saber o valor efetivo do outro.
 */
export function assertSplitPartsValid(splitParts: number, userPart: number) {
  if (userPart > splitParts) {
    throw new BadRequestException(
      'userPart must be less than or equal to splitParts',
    );
  }
}
