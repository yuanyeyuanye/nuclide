/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */


import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {HackSearchPosition} from './HackService';
import type {Completion} from './rpc-types';
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {
  Definition,
  DefinitionQueryResult,
} from '../../nuclide-definition-service/lib/rpc-types';
import type {Outline} from '../../nuclide-outline-view/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {FindReferencesReturn} from '../../nuclide-find-references/lib/rpc-types';
import type {
  DiagnosticProviderUpdate,
  FileDiagnosticUpdate,
} from '../../nuclide-diagnostics-common/lib/rpc-types';
import type {ConnectableObservable} from 'rxjs';

export interface LanguageService {

  getDiagnostics(
    fileVersion: FileVersion,
  ): Promise<?DiagnosticProviderUpdate>,

  observeDiagnostics(): ConnectableObservable<FileDiagnosticUpdate>,

  getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    activatedManually: boolean,
  ): Promise<Array<Completion>>,

  getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult>,

  getDefinitionById(
    file: NuclideUri,
    id: string,
  ): Promise<?Definition>,

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn>,

  executeQuery(
    rootDirectory: NuclideUri,
    queryString: string,
  ): Promise<Array<HackSearchPosition>>,

  getCoverage(
    filePath: NuclideUri,
  ): Promise<?CoverageResult>,

  getOutline(
    fileVersion: FileVersion,
  ): Promise<?Outline>,

  typeHint(fileVersion: FileVersion, position: atom$Point): Promise<?TypeHint>,

  highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<Array<atom$Range>>,

  formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
  ): Promise<string>,

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri>,

  isFileInProject(fileUri: NuclideUri): Promise<boolean>,

  dispose(): void,
}
