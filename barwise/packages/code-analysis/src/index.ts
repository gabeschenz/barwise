// Formats
export { JavaImportFormat } from "./formats/JavaImportFormat.js";
export { buildModelFromJvmContext } from "./formats/jvmModelBuilder.js";
export { KotlinImportFormat } from "./formats/KotlinImportFormat.js";
export {
  createJavaFormat,
  createKotlinFormat,
  createTypeScriptFormat,
  registerCodeFormats,
} from "./formats/registration.js";
export { TypeScriptImportFormat } from "./formats/TypeScriptImportFormat.js";

// LSP infrastructure
export { LspJsonRpc } from "./lsp/LspJsonRpc.js";
export { LspManager } from "./lsp/LspManager.js";
export { LspSessionImpl } from "./lsp/LspSession.impl.js";
export { defaultJavaConfig } from "./lsp/servers/java.js";
export { defaultKotlinConfig } from "./lsp/servers/kotlin.js";
export { defaultTypeScriptConfig } from "./lsp/servers/typescript.js";

// Context assembler and collectors
export { collectAnnotations } from "./context/AnnotationCollector.js";
export { assembleTypeScriptContext } from "./context/ContextAssembler.js";
export { filterByGuidingModel, loadGuidingEntityNames } from "./context/GuidingModelLoader.js";
export { assembleJavaContext, assembleKotlinContext } from "./context/JvmContextAssembler.js";
export { collectStateTransitions } from "./context/StateTransitionCollector.js";
export { collectTypeDefinitions } from "./context/TypeCollector.js";
export { collectValidations } from "./context/ValidationCollector.js";

// Prompt
export { buildCodeExtractionPrompt } from "./prompt/CodeExtractionPrompt.js";

// Types
export type {
  AnnotationConstraintContext,
  CallHierarchyItem,
  CodeContext,
  CodeImportOptions,
  DocumentSymbol,
  HoverResult,
  Location,
  LspConfig,
  LspSession,
  LspSessionProvider,
  Position,
  Range,
  StateTransitionContext,
  SymbolInformation,
  SymbolReference,
  TypeDefinitionContext,
  ValidationContext,
} from "./types.js";
export { SymbolKind } from "./types.js";

// Repository analysis
export { buildFileContains, detectBuildSystem } from "./repo/BuildSystemDetector.js";
export { getDetectors } from "./repo/detectors/index.js";
export { countLanguages, detectLanguage } from "./repo/LanguageDetector.js";
export { RepoManager } from "./repo/RepoManager.js";
export { detectFramework, profileRepository } from "./repo/RepoProfiler.js";
export { formatRepoRef, parseRepoRef } from "./repo/types.js";
export type {
  AnalysisMetadata,
  BuildSystemDetection,
  CloneOptions,
  DetectedLanguage,
  FrameworkDetection,
  FrameworkDetectorConfig,
  FrameworkSignal,
  ProfileCacheEntry,
  ProfileCacheKey,
  RepoProfile,
  RepoRef,
  SignalConfig,
  SignalWeight,
} from "./repo/types.js";
