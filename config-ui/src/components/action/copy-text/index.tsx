/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { CopyToClipboard } from 'react-copy-to-clipboard';
import { message } from 'antd';
import styled from 'styled-components';

import { TextTooltip, IconButton } from '@/components';

import CopyIcon from './assets/copy.svg';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: #f0f4fe;
`;

interface Props {
  content: string;
}

export const CopyText = ({ content }: Props) => {
  return (
    <Wrapper>
      <TextTooltip style={{ width: '90%' }} content={content}>
        {content}
      </TextTooltip>
      <CopyToClipboard text={content} onCopy={() => message.success('Copy successfully.')}>
        <IconButton image={<img src={CopyIcon} alt="" />} tooltip="Copy" />
      </CopyToClipboard>
    </Wrapper>
  );
};
