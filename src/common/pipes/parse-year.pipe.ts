import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseYearPipe implements PipeTransform {
  transform(value: string | undefined): number | undefined {
    if (value === undefined || value === '') return undefined;
    const year = parseInt(value, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year must be between 2000 and 2100');
    }
    return year;
  }
}
