import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  providers: [CryptoService, SupabaseStorageService],
  exports: [CryptoService, SupabaseStorageService],
})
export class CommonModule {}
