import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExpenseEntryDto } from './create-expense-entry.dto';
import { UpdateExpenseEntryDto } from './update-expense-entry.dto';

describe('description em ExpenseEntry DTOs', () => {
  describe('CreateExpenseEntryDto', () => {
    it('deve aceitar descrição com até 100 caracteres', async () => {
      const dto = plainToInstance(CreateExpenseEntryDto, {
        amount: 10,
        description: 'a'.repeat(100),
      });

      expect(await validate(dto)).toHaveLength(0);
    });

    it('deve rejeitar descrição com mais de 100 caracteres', async () => {
      const dto = plainToInstance(CreateExpenseEntryDto, {
        amount: 10,
        description: 'a'.repeat(101),
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
    });

    it('deve aplicar trim e ignorar descrição vazia', async () => {
      const trimmed = plainToInstance(CreateExpenseEntryDto, {
        amount: 10,
        description: '  Padaria  ',
      });
      const blank = plainToInstance(CreateExpenseEntryDto, {
        amount: 10,
        description: '   ',
      });

      expect(trimmed.description).toBe('Padaria');
      expect(blank.description).toBeUndefined();
      expect(await validate(blank)).toHaveLength(0);
    });
  });

  describe('UpdateExpenseEntryDto', () => {
    it('deve aceitar null para limpar a descrição', async () => {
      const dto = plainToInstance(UpdateExpenseEntryDto, {
        description: null,
      });

      expect(dto.description).toBeNull();
      expect(await validate(dto)).toHaveLength(0);
    });

    it('deve converter descrição vazia em null', async () => {
      const dto = plainToInstance(UpdateExpenseEntryDto, { description: '' });

      expect(dto.description).toBeNull();
      expect(await validate(dto)).toHaveLength(0);
    });

    it('deve rejeitar descrição com mais de 100 caracteres', async () => {
      const dto = plainToInstance(UpdateExpenseEntryDto, {
        description: 'a'.repeat(101),
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
    });

    it('deve rejeitar descrição que não é string', async () => {
      const dto = plainToInstance(UpdateExpenseEntryDto, { description: 123 });

      expect(await validate(dto)).not.toHaveLength(0);
    });
  });
});
