// Generic declaration for .cjs modules so TypeScript doesn't complain about missing types.
// Specific modules can still provide their own richer declarations.
declare module '*.cjs' {
  const value: any;
  export default value;
}

// Explicit declaration for the canvas proto module (ensures exact specifier match)
declare module '../proto/_canvas_pb.cjs' {
  const mod: any;
  export default mod;
}
