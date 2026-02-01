# Security Considerations

## Critical Security Notes

### Key Management
- Private keys should never leave secure enclaves
- Use hardware security modules (HSM) for production
- Implement key rotation policies

### Revocation
- Revocation proofs must be broadcast to all verifiers
- Consider using a revocation registry for offline verification
- Monitor for revocation chain forks

### Privacy
- Use different pseudonyms per vendor category
- Implement mandatory data deletion policies
- Consider differential privacy for aggregate statistics

### Implementation
- Use constant-time cryptographic operations
- Validate all inputs before processing
- Implement rate limiting and DoS protection

## Known Limitations (v0.2.0-alpha)

1. **No ZK proofs yet** - Privacy relies on pseudonyms only
2. **No formal verification** - Cryptographic constructs not formally verified
3. **No HSM integration** - Keys stored in memory

## Reporting Vulnerabilities

Please report security vulnerabilities to: security@sovereign-ap2.example.org
