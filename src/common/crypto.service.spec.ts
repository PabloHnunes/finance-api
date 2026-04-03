import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY =
      'a'.repeat(64);
    service = new CryptoService();
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('deve criptografar e descriptografar corretamente', () => {
    const plaintext = '12345678901';

    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it('deve gerar ciphertexts diferentes para o mesmo plaintext (IV aleatório)', () => {
    const plaintext = '12345678901';

    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('deve produzir formato iv:tag:encrypted', () => {
    const encrypted = service.encrypt('teste');
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // IV: 12 bytes = 24 hex chars
    expect(parts[1]).toHaveLength(32); // Tag: 16 bytes = 32 hex chars
  });

  it('deve lançar erro se ENCRYPTION_KEY não está definida', () => {
    delete process.env.ENCRYPTION_KEY;

    expect(() => new CryptoService()).toThrow(
      'ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
    );
  });

  it('deve lançar erro se ENCRYPTION_KEY tem tamanho inválido', () => {
    process.env.ENCRYPTION_KEY = 'abc123';

    expect(() => new CryptoService()).toThrow(
      'ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
    );
  });
});
