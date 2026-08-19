import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { TenantContext } from '../database/database.service';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantObjectStorageService {
  private readonly root: string;
  private readonly driver: 'local' | 's3';
  private readonly s3?: S3Client;
  private readonly bucket?: string;

  constructor(
    @Optional() @Inject('TENANT_STORAGE_ROOT') root?: string,
    @Optional() @Inject('TENANT_S3_CLIENT') s3Client?: S3Client,
  ) {
    this.root = root ?? process.env.TENANT_STORAGE_ROOT ?? join(process.cwd(), 'storage', 'tenants');
    this.driver = process.env.OBJECT_STORAGE_DRIVER === 's3' ? 's3' : 'local';
    if (this.driver === 's3') {
      this.bucket = process.env.OBJECT_STORAGE_BUCKET;
      if (!this.bucket) throw new Error('OBJECT_STORAGE_BUCKET obrigatório para driver s3.');
      this.s3 = s3Client ?? new S3Client({
        region: process.env.OBJECT_STORAGE_REGION ?? 'sa-east-1',
        endpoint: process.env.OBJECT_STORAGE_ENDPOINT || undefined,
        forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === '1',
      });
    }
  }

  criarChave(contexto: TenantContext, tipo: string, objectId: string, extensao = 'bin') {
    if (typeof tipo !== 'string' || typeof objectId !== 'string' || typeof extensao !== 'string')
      throw new Error('Parâmetros de storage devem ser strings.');
    if (!UUID.test(contexto.tenantId) || !UUID.test(contexto.organizationId) || !UUID.test(objectId))
      throw new Error('Identificador de storage inválido.');
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(tipo) || !/^[a-z0-9]{1,10}$/.test(extensao))
      throw new Error('Tipo ou extensão de storage inválido.');
    return `tenants/${contexto.tenantId}/organizations/${contexto.organizationId}/${tipo}/${objectId}.${extensao}`;
  }

  private validarChave(contexto: TenantContext, chave: unknown): asserts chave is string {
    if (typeof chave !== 'string') throw new Error('Chave de storage inválida.');
    const prefixo = `tenants/${contexto.tenantId}/organizations/${contexto.organizationId}/`;
    if (!chave.startsWith(prefixo) || chave.includes('..') || chave.includes('\\'))
      throw new Error('Objeto fora do namespace tenant.');
  }

  private caminho(contexto: TenantContext, chave: unknown) {
    this.validarChave(contexto, chave);
    const raiz = resolve(this.root);
    const alvo = resolve(this.root, ...chave.split('/'));
    if (!alvo.startsWith(`${raiz}${sep}`)) throw new Error('Caminho de objeto inválido.');
    return alvo;
  }

  async gravar(contexto: TenantContext, chave: string, dados: Buffer) {
    this.validarChave(contexto, chave);
    if (!Buffer.isBuffer(dados)) throw new Error('Conteúdo de storage inválido.');
    const sha256 = createHash('sha256').update(dados).digest('hex');
    if (this.driver === 's3') {
      await this.s3!.send(new PutObjectCommand({
        Bucket: this.bucket!, Key: chave, Body: dados,
        ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64'),
        ServerSideEncryption: process.env.OBJECT_STORAGE_KMS_KEY ? 'aws:kms' : 'AES256',
        SSEKMSKeyId: process.env.OBJECT_STORAGE_KMS_KEY || undefined,
        IfNoneMatch: '*',
      }));
      return { chave, bytes: dados.byteLength, sha256 };
    }
    const alvo = this.caminho(contexto, chave);
    await mkdir(dirname(alvo), { recursive: true });
    const semLink = constants.O_NOFOLLOW ?? 0;
    const arquivo = await open(alvo, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | semLink, 0o600);
    try {
      await arquivo.writeFile(dados);
      await arquivo.sync();
    } finally { await arquivo.close(); }
    return { chave, bytes: dados.byteLength, sha256 };
  }

  async ler(contexto: TenantContext, chave: string) {
    this.validarChave(contexto, chave);
    if (this.driver === 's3') {
      const resposta = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket!, Key: chave }));
      if (!resposta.Body) throw new Error('Objeto sem conteúdo.');
      return Buffer.from(await resposta.Body.transformToByteArray());
    }
    const alvo = this.caminho(contexto, chave);
    const semLink = constants.O_NOFOLLOW ?? 0;
    const arquivo = await open(alvo, constants.O_RDONLY | semLink);
    try {
      const info = await arquivo.stat();
      if (!info.isFile()) throw new Error('Objeto inválido.');
      return await arquivo.readFile();
    } finally { await arquivo.close(); }
  }

  async urlAssinada(contexto: TenantContext, chave: string, ttlSegundos = 300) {
    this.validarChave(contexto, chave);
    if (this.driver !== 's3') throw new Error('URL assinada exige object storage S3.');
    const ttl = Math.min(Math.max(30, ttlSegundos), 900);
    await this.s3!.send(new HeadObjectCommand({ Bucket: this.bucket!, Key: chave }));
    return getSignedUrl(this.s3!, new GetObjectCommand({ Bucket: this.bucket!, Key: chave }), { expiresIn: ttl });
  }
}
