'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {HintTree} from './rpc-types';

import {TextBuffer} from 'atom';
import {React} from 'react-for-atom';
import {AtomTextEditor} from '../../nuclide-ui/AtomTextEditor';

type TypeHintComponentProps = {
  content: string | HintTree,
  grammar: atom$Grammar,
};

type TypeHintComponentState = {
  expandedNodes: Set<HintTree>,
};

export function makeTypeHintComponent(
  content: string | HintTree,
  grammar: atom$Grammar,
): ReactClass<any> {
  return () => <TypeHintComponent content={content} grammar={grammar} />;
}

class TypeHintComponent extends React.Component {
  props: TypeHintComponentProps;
  state: TypeHintComponentState;

  constructor(props: TypeHintComponentProps) {
    super(props);
    this.state = {
      expandedNodes: new Set(),
    };
  }

  renderPrimitive(value: string): React.Element<any> {
    const buffer = new TextBuffer(value);
    const {grammar} = this.props;
    return (
      <div className="nuclide-type-hint-text-editor-container">
        <AtomTextEditor
          className="nuclide-type-hint-text-editor"
          gutterHidden={true}
          readOnly={true}
          syncTextContents={false}
          autoGrow={true}
          grammar={grammar}
          textBuffer={buffer}
        />
      </div>
    );
  }

  handleChevronClick(tree: HintTree, event: SyntheticEvent): void {
    const {expandedNodes} = this.state;
    if (expandedNodes.has(tree)) {
      expandedNodes.delete(tree);
    } else {
      expandedNodes.add(tree);
    }
    // Force update.
    this.forceUpdate();
  }

  renderHierarchical(tree: HintTree): React.Element<any> {
    if (tree.children == null) {
      return this.renderPrimitive(tree.value);
    }
    const children = tree.children.map(child => this.renderHierarchical(child));
    const isExpanded = this.state.expandedNodes.has(tree);
    const childrenList = isExpanded
      ? <ul className="list-tree">
          {children}
        </ul>
      : null;
    const className =
      'icon nuclide-type-hint-expandable-chevron ' +
      `icon-chevron-${isExpanded ? 'down' : 'right'}`;
    return (
      <li className="list-nested-item">
        <div className="list-item">
          <span>
            <span
              className={className}
              onClick={this.handleChevronClick.bind(this, tree)}
            />
            {tree.value}
          </span>
        </div>
        {childrenList}
      </li>
    );
  }

  render(): React.Element<any> {
    const {content} = this.props;
    if (typeof content === 'string') {
      return this.renderPrimitive(content);
    }
    return (
      <ul className="list-tree">
        {this.renderHierarchical(content)}
      </ul>
    );
  }
}
