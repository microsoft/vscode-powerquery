// // Copyright (c) Microsoft Corporation.
// // Licensed under the MIT license.

// import { expect } from "chai";
// import "mocha";

// import * as PQLS from "@microsoft/powerquery-language-services";
// import * as PQP from "@microsoft/powerquery-parser";

// import { StandardLibraryDefinitions } from "../../library/standardLibrary";

// const assertIsConstructor: (
//     definition: PQLS.Library.TLibraryDefinition,
// ) => asserts definition is PQLS.Library.LibraryConstructor = PQLS.Library.assertIsConstructor;

// const assertIsFunction: (
//     definition: PQLS.Library.TLibraryDefinition,
// ) => asserts definition is PQLS.Library.LibraryFunction = PQLS.Library.assertIsFunction;

// describe("Library export", () => {
//     it("index const by name", () => {
//         const definitionKey: string = "BinaryOccurrence.Required";
//         const maybeLibraryDefinition: PQLS.Library.TLibraryDefinition | undefined = StandardLibraryDefinitions.get(
//             definitionKey,
//         );
//         if (maybeLibraryDefinition === undefined) {
//             throw new Error(`expected constant '${definitionKey}' was not found`);
//         }
//         const libraryDefinition: PQLS.Library.TLibraryDefinition = maybeLibraryDefinition;

//         expect(libraryDefinition.label).eq(definitionKey, "unexpected label");
//         expect(libraryDefinition.description.length).greaterThan(0, "summary should not be empty");
//         expect(libraryDefinition.kind).eq(PQLS.Library.LibraryDefinitionKind.Constant);
//         expect(libraryDefinition.primitiveType.kind).eq(PQP.Language.Type.TypeKind.Number);
//     });

//     it("index function by name", () => {
//         const exportKey: string = "List.Distinct";
//         const maybeLibraryDefinition: PQLS.Library.TLibraryDefinition | undefined = StandardLibraryDefinitions.get(
//             exportKey,
//         );
//         if (maybeLibraryDefinition === undefined) {
//             throw new Error(`expected constant '${exportKey}' was not found`);
//         }
//         const libraryDefinition: PQLS.Library.TLibraryDefinition = maybeLibraryDefinition;
//         assertIsFunction(libraryDefinition);

//         expect(libraryDefinition.label !== null);
//         expect(libraryDefinition.signatures !== null);
//         expect(libraryDefinition.signatures.length).eq(2, "expecting 2 signatures");
//         expect(libraryDefinition.signatures[0].parameters.length).eq(1, "expecting 1 parameter in first signature");
//         expect(libraryDefinition.signatures[0].parameters[0].typeKind).eq(PQP.Language.Type.TypeKind.List);
//     });

//     it("#date constructor", () => {
//         const exportKey: string = "#date";
//         const maybeLibraryDefinition: PQLS.Library.TLibraryDefinition | undefined = StandardLibraryDefinitions.get(
//             exportKey,
//         );
//         if (maybeLibraryDefinition === undefined) {
//             throw new Error(`expected constant '${exportKey}' was not found`);
//         }
//         const libraryDefinition: PQLS.Library.TLibraryDefinition = maybeLibraryDefinition;
//         assertIsConstructor(libraryDefinition);

//         expect(libraryDefinition.label !== null);
//         expect(libraryDefinition.signatures !== null);
//         expect(libraryDefinition.kind).eq(PQLS.Library.LibraryDefinitionKind.Constructor);
//         expect(libraryDefinition.signatures[0].parameters.length).eq(3, "expecting 3 parameters in first signature");
//         expect(libraryDefinition.signatures[0].parameters[0].label).eq("year");
//         expect(libraryDefinition.signatures[0].parameters[0].typeKind).eq(PQP.Language.Type.TypeKind.Number);
//     });
// });
