'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {GetToolBar} from '../../commons-atom/suda-tool-bar';
import type {WorkspaceViewsService} from '../../nuclide-workspace-views/lib/types';
import type {HealthStats, PaneItemState} from './types';

// Imports from non-Nuclide modules.
import invariant from 'assert';
import {CompositeDisposable, Disposable} from 'atom';
import {React} from 'react-for-atom';
import {Observable} from 'rxjs';

// Imports from other Nuclide packages.
import {track} from '../../nuclide-analytics';
import createPackage from '../../commons-atom/createPackage';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import featureConfig from '../../commons-atom/featureConfig';
import UniversalDisposable from '../../commons-node/UniversalDisposable';

// Imports from within this Nuclide package.
import HealthPaneItem from './HealthPaneItem';
import getChildProcessesTree from './getChildProcessesTree';
import getStats from './getStats';

class Activation {
  _paneItemStates: Observable<PaneItemState>;
  _subscriptions: CompositeDisposable;

  _healthButton: ?HTMLElement;

  constructor(state: ?Object): void {
    (this: any)._updateAnalytics = this._updateAnalytics.bind(this);
    (this: any)._updateToolbarJewel = this._updateToolbarJewel.bind(this);

    // Observe all of the settings.
    const configs = featureConfig.observeAsStream('nuclide-health');
    const viewTimeouts = configs.map(config => config.viewTimeout * 1000).distinctUntilChanged();
    const analyticsTimeouts = configs
      .map(config => config.analyticsTimeout * 60 * 1000)
      .distinctUntilChanged();
    const toolbarJewels = configs.map(config => config.toolbarJewel || '').distinctUntilChanged();

    // Update the stats immediately, and then periodically based on the config.
    const statsStream = Observable.of(null)
      .concat(viewTimeouts.switchMap(Observable.interval))
      .map(getStats)
      .share();

    const childProcessesTreeStream = Observable.of(null)
      .concat(viewTimeouts.switchMap(Observable.interval))
      .switchMap(getChildProcessesTree)
      .share();

    const packageStates = statsStream
      .withLatestFrom(toolbarJewels)
      .map(([stats, toolbarJewel]) => ({stats, toolbarJewel}))
      .share()
      .cache(1);

    const updateToolbarJewel = value => {
      featureConfig.set('nuclide-health.toolbarJewel', value);
    };
    this._paneItemStates = Observable.combineLatest(
      packageStates,
      Observable.of(null).concat(childProcessesTreeStream),
      (packageState, childProcessesTree) => ({
        ...packageState,
        childProcessesTree,
        updateToolbarJewel,
      }),
    );

    this._subscriptions = new CompositeDisposable(
      // Keep the toolbar jewel up-to-date.
      new UniversalDisposable(
        packageStates
          .map(formatToolbarJewelLabel)
          .subscribe(this._updateToolbarJewel),
      ),

      // Buffer the stats and send analytics periodically.
      new UniversalDisposable(
        statsStream
          .buffer(analyticsTimeouts.switchMap(Observable.interval))
          .subscribe(this._updateAnalytics),
      ),
    );
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  consumeToolBar(getToolBar: GetToolBar): IDisposable {
    const toolBar = getToolBar('nuclide-health');
    this._healthButton = toolBar.addButton({
      icon: 'dashboard',
      callback: 'nuclide-health:toggle',
      tooltip: 'Toggle Nuclide health stats',
      priority: -400,
    }).element;
    this._healthButton.classList.add('nuclide-health-jewel');
    const disposable = new Disposable(() => {
      this._healthButton = null;
      toolBar.removeItems();
    });
    this._subscriptions.add(disposable);
    return disposable;
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    invariant(this._paneItemStates);
    this._subscriptions.add(
      api.registerFactory({
        id: 'nuclide-health',
        name: 'Health',
        iconName: 'dashboard',
        toggleCommand: 'nuclide-health:toggle',
        defaultLocation: 'pane',
        create: () => {
          invariant(this._paneItemStates != null);
          return viewableFromReactElement(<HealthPaneItem stateStream={this._paneItemStates} />);
        },
        isInstance: item => item instanceof HealthPaneItem,
      }),
    );
  }

  _updateToolbarJewel(label: string): void {
    const healthButton = this._healthButton;
    if (healthButton != null) {
      healthButton.classList.toggle('updated', healthButton.dataset.jewelValue !== label);
      healthButton.dataset.jewelValue = label;
    }
  }

  _updateAnalytics(analyticsBuffer: Array<HealthStats>): void {
    if (analyticsBuffer.length === 0) { return; }

    // Aggregates the buffered stats up by suffixing avg, min, max to their names.
    const aggregateStats = {};

    // All analyticsBuffer entries have the same keys; we use the first entry to know what they
    // are.
    Object.keys(analyticsBuffer[0]).forEach(statsKey => {
      // These values are not to be aggregated or sent.
      if (statsKey === 'activeHandlesByType') {
        return;
      }

      const aggregates = aggregate(
        analyticsBuffer.map(
          stats => (typeof stats[statsKey] === 'number' ? stats[statsKey] : 0),
        ),
      );
      Object.keys(aggregates).forEach(aggregatesKey => {
        const value = aggregates[aggregatesKey];
        if (value !== null && value !== undefined) {
          aggregateStats[`${statsKey}_${aggregatesKey}`] = value.toFixed(2);
        }
      });
    });
    track('nuclide-health', aggregateStats);
  }

}

function aggregate(
  values: Array<number>,
): {avg: ?number, min: ?number, max: ?number} {
  const avg = values.reduce((prevValue, currValue, index) => {
    return prevValue + (currValue - prevValue) / (index + 1);
  }, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {avg, min, max};
}

function formatToolbarJewelLabel(opts: {stats: HealthStats, toolbarJewel: string}): string {
  const {stats, toolbarJewel} = opts;
  switch (toolbarJewel) {
    case 'CPU':
      return `${stats.cpuPercentage.toFixed(0)}%`;
    case 'Heap':
      return `${stats.heapPercentage.toFixed(0)}%`;
    case 'Memory':
      return `${Math.floor(stats.rss / 1024 / 1024)}M`;
    case 'Handles':
      return `${stats.activeHandles}`;
    case 'Child processes':
      return `${stats.activeHandlesByType.childprocess.length}`;
    case 'Event loop':
      return `${stats.activeRequests}`;
    default:
      return '';
  }
}

export default createPackage(Activation);
