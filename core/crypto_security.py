#!/usr/bin/env python3
"""
Cryptography Security Wrapper for TrendSiam

This module provides secure cryptographic operations and prevents usage of
vulnerable APIs. All cryptographic operations should go through this module.

Security measures:
- Blocks RSA PKCS1v15 padding for decryption (forces OAEP)
- Validates PKCS#12 certificate/key matching
- Provides secure defaults for all operations
"""

import hashlib
from typing import Optional, Tuple, Any
from pathlib import Path
import logging

# Import only what we need from cryptography
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from cryptography.x509 import Certificate, load_pem_x509_certificate
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class CryptoSecurityError(Exception):
    """Raised when a security policy is violated"""
    pass


class SecureCrypto:
    """
    Secure cryptography wrapper that enforces security best practices
    """
    
    @staticmethod
    def generate_rsa_key_pair(key_size: int = 4096) -> Tuple[RSAPrivateKey, RSAPublicKey]:
        """
        Generate secure RSA key pair
        
        Args:
            key_size: Key size in bits (minimum 2048, default 4096)
            
        Returns:
            Tuple of (private_key, public_key)
        """
        if key_size < 2048:
            raise CryptoSecurityError("RSA key size must be at least 2048 bits")
        
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=key_size,
            backend=default_backend()
        )
        public_key = private_key.public_key()
        
        logger.info(f"Generated {key_size}-bit RSA key pair")
        return private_key, public_key
    
    @staticmethod
    def rsa_encrypt(data: bytes, public_key: RSAPublicKey) -> bytes:
        """
        Encrypt data using RSA with OAEP padding (secure)
        
        Args:
            data: Data to encrypt
            public_key: RSA public key
            
        Returns:
            Encrypted data
        """
        # Always use OAEP for encryption
        ciphertext = public_key.encrypt(
            data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return ciphertext
    
    @staticmethod
    def rsa_decrypt(ciphertext: bytes, private_key: RSAPrivateKey) -> bytes:
        """
        Decrypt data using RSA with OAEP padding (secure)
        
        SECURITY: This method ONLY supports OAEP padding.
        PKCS1v15 padding is explicitly blocked for decryption.
        
        Args:
            ciphertext: Encrypted data
            private_key: RSA private key
            
        Returns:
            Decrypted data
        """
        # SECURITY: Only allow OAEP padding for decryption
        plaintext = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return plaintext
    
    @staticmethod
    def rsa_sign(data: bytes, private_key: RSAPrivateKey) -> bytes:
        """
        Sign data using RSA with PSS padding (secure)
        
        Args:
            data: Data to sign
            private_key: RSA private key
            
        Returns:
            Signature
        """
        # Use PSS for signing (more secure than PKCS1v15)
        signature = private_key.sign(
            data,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature
    
    @staticmethod
    def rsa_verify(signature: bytes, data: bytes, public_key: RSAPublicKey) -> bool:
        """
        Verify RSA signature with PSS padding
        
        Args:
            signature: Signature to verify
            data: Original data
            public_key: RSA public key
            
        Returns:
            True if signature is valid
        """
        try:
            public_key.verify(
                signature,
                data,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except InvalidSignature:
            return False
    
    @staticmethod
    def rsa_verify_pkcs1v15(signature: bytes, data: bytes, public_key: RSAPublicKey) -> bool:
        """
        Verify RSA signature with PKCS1v15 padding (for compatibility only)
        
        NOTE: PKCS1v15 is allowed for signature VERIFICATION only, not decryption
        
        Args:
            signature: Signature to verify
            data: Original data
            public_key: RSA public key
            
        Returns:
            True if signature is valid
        """
        try:
            public_key.verify(
                signature,
                data,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            return True
        except InvalidSignature:
            return False
    
    @staticmethod
    def validate_certificate_key_match(cert: Certificate, private_key: RSAPrivateKey) -> bool:
        """
        Validate that a certificate matches a private key
        
        Args:
            cert: X.509 certificate
            private_key: RSA private key
            
        Returns:
            True if certificate public key matches private key
        """
        try:
            cert_public_key = cert.public_key()
            private_public_key = private_key.public_key()
            
            # Compare public key parameters
            if isinstance(cert_public_key, RSAPublicKey) and isinstance(private_public_key, RSAPublicKey):
                cert_numbers = cert_public_key.public_numbers()
                private_numbers = private_public_key.public_numbers()
                
                return (cert_numbers.n == private_numbers.n and 
                        cert_numbers.e == private_numbers.e)
            
            return False
        except Exception as e:
            logger.error(f"Error validating certificate/key match: {e}")
            return False
    
    @staticmethod
    def derive_key_from_password(password: str, salt: bytes, key_length: int = 32) -> bytes:
        """
        Derive encryption key from password using PBKDF2
        
        Args:
            password: Password string
            salt: Salt bytes (should be random, at least 16 bytes)
            key_length: Desired key length in bytes
            
        Returns:
            Derived key
        """
        if len(salt) < 16:
            raise CryptoSecurityError("Salt must be at least 16 bytes")
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=key_length,
            salt=salt,
            iterations=100000,  # NIST recommended minimum
            backend=default_backend()
        )
        
        key = kdf.derive(password.encode('utf-8'))
        return key
    
    @staticmethod
    def hash_data(data: bytes, algorithm: str = 'sha256') -> str:
        """
        Hash data using specified algorithm
        
        Args:
            data: Data to hash
            algorithm: Hash algorithm ('sha256', 'sha512')
            
        Returns:
            Hex digest of hash
        """
        if algorithm not in ['sha256', 'sha512']:
            raise CryptoSecurityError(f"Unsupported hash algorithm: {algorithm}")
        
        hasher = hashlib.new(algorithm)
        hasher.update(data)
        return hasher.hexdigest()


# Banned API detector for testing
def detect_insecure_crypto_usage(code_content: str) -> list:
    """
    Detect insecure cryptography API usage in code
    
    Args:
        code_content: Python code content to check
        
    Returns:
        List of security issues found
    """
    issues = []
    
    # Check for PKCS1v15 decryption
    if 'padding.PKCS1v15()' in code_content and 'decrypt' in code_content:
        issues.append("DANGEROUS: RSA decryption with PKCS1v15 padding detected")
    
    # Check for direct PKCS#12 usage without validation
    if 'pkcs12.serialize_key_and_certificates' in code_content:
        if 'validate_certificate_key_match' not in code_content:
            issues.append("WARNING: PKCS#12 usage without certificate/key validation")
    
    # Check for weak key sizes
    if 'key_size=1024' in code_content or 'key_size = 1024' in code_content:
        issues.append("DANGEROUS: Weak RSA key size (1024 bits) detected")
    
    # Check for hardcoded keys/passwords
    if 'private_key = "' in code_content or "private_key = '" in code_content:
        issues.append("DANGEROUS: Hardcoded private key detected")
    
    return issues


# Example safe usage
if __name__ == "__main__":
    # Example: Generate keys
    private_key, public_key = SecureCrypto.generate_rsa_key_pair()
    
    # Example: Encrypt/decrypt with OAEP (secure)
    message = b"Secret message"
    encrypted = SecureCrypto.rsa_encrypt(message, public_key)
    decrypted = SecureCrypto.rsa_decrypt(encrypted, private_key)
    assert decrypted == message
    
    # Example: Sign/verify with PSS (secure)
    signature = SecureCrypto.rsa_sign(message, private_key)
    valid = SecureCrypto.rsa_verify(signature, message, public_key)
    assert valid
    
    print("✅ All secure crypto operations completed successfully")
