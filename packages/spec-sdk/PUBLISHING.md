# Publishing `spec-sdk` to npm

Build generated artifacts and publish the package (public scope):

```bash
cd packages/spec-sdk
pnpm build
npm publish --access public
```

Downstream services (for example **spec-score**) depend on this package from the registry for ATProto lexicon types and crypto helpers. Use a `file:` dependency or link only for local development until a version is published.
