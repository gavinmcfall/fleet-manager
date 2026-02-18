// Package crypto provides AES-256-GCM encryption for sensitive API keys.
// It uses authenticated encryption with unique nonces per encryption to
// securely store LLM provider API keys in the database.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// encryptionKey is the AES-256 key used for encrypting/decrypting sensitive data.
// Set via InitEncryption; unexported to prevent direct access.
var encryptionKey []byte

// InitEncryption initializes the encryption key from environment or generates one.
func InitEncryption(keyString string) error {
	if keyString == "" {
		// Generate a random key if none provided (for development)
		// In production, this should be set via environment variable
		encryptionKey = make([]byte, 32)
		if _, err := io.ReadFull(rand.Reader, encryptionKey); err != nil {
			return err
		}
		return nil
	}

	// Decode base64 key from environment
	key, err := base64.StdEncoding.DecodeString(keyString)
	if err != nil {
		return err
	}

	if len(key) != 32 {
		return errors.New("encryption key must be 32 bytes for AES-256")
	}

	encryptionKey = key
	return nil
}

// Encrypt encrypts plaintext using AES-256-GCM.
func Encrypt(plaintext string) (string, error) {
	if len(encryptionKey) == 0 {
		return "", errors.New("encryption key not initialized")
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts ciphertext using AES-256-GCM.
func Decrypt(ciphertext string) (string, error) {
	if len(encryptionKey) == 0 {
		return "", errors.New("encryption key not initialized")
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// MaskAPIKey returns a masked version of the API key for display (e.g., "sk-...abc123")
func MaskAPIKey(apiKey string) string {
	if apiKey == "" {
		return ""
	}

	if len(apiKey) <= 10 {
		return "***"
	}

	// Show first 3 chars and last 4 chars
	return apiKey[:3] + "..." + apiKey[len(apiKey)-4:]
}
