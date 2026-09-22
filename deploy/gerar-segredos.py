#!/usr/bin/env python3
"""Gera os valores secretos do .env de produção sem precisar do .NET SDK.

Uso: python3 deploy/gerar-segredos.py
Pede a senha do administrador e imprime POSTGRES_PASSWORD, ADMIN_SENHA_HASH e
JWT_CHAVE_SECRETA prontos para colar no .env. O hash segue o formato V3 do
PasswordHasher do ASP.NET Core (PBKDF2-HMACSHA512, 100.000 iterações, salt de
16 bytes, subchave de 32 bytes), o mesmo verificado pela API no login.
"""
import base64
import getpass
import hashlib
import secrets
import struct
import sys

PRF_HMACSHA512 = 2
ITERACOES = 100_000


def hash_aspnet(senha: str) -> str:
    salt = secrets.token_bytes(16)
    subchave = hashlib.pbkdf2_hmac("sha512", senha.encode("utf-8"), salt, ITERACOES, 32)
    cabecalho = b"\x01" + struct.pack(">III", PRF_HMACSHA512, ITERACOES, len(salt))
    return base64.b64encode(cabecalho + salt + subchave).decode("ascii")


def main() -> None:
    senha = getpass.getpass("Senha do administrador: ")
    if len(senha) < 8:
        sys.exit("Use uma senha com pelo menos 8 caracteres.")
    if senha != getpass.getpass("Confirme a senha: "):
        sys.exit("As senhas não conferem.")

    print()
    print(f"POSTGRES_PASSWORD={secrets.token_urlsafe(24)}")
    print(f"ADMIN_SENHA_HASH={hash_aspnet(senha)}")
    print(f"JWT_CHAVE_SECRETA={secrets.token_urlsafe(48)}")


if __name__ == "__main__":
    main()
