import * as vscode from 'vscode';

import { createLogger } from './logging';

const log = createLogger('Atlas API controller');

const ACCEPT_HEADER = 'application/vnd.atlas.2024-08-05+json';
const BASE_URL = 'https://cloud-dev.mongodb.com/api/atlas/v2/';
const AUTH_URL = 'https://cloud-dev.mongodb.com/api/oauth/token';

export default class AtlasApiController {
  private _clientCreds: { clientId: string; clientSecret: string } | null =
    null;
  private _tokenData: { accessToken: string; expiresAt: Date } | null = null;

  constructor() {}

  async _saveClientCredsWithInputBox(
    stream?: vscode.ChatResponseStream,
  ): Promise<void> {
    stream?.progress(
      'Please enter your Atlas Client ID and Client Secret in the input prompts.',
    );
    const clientId = await vscode.window.showInputBox({
      prompt: 'Enter your Atlas Client ID',
      ignoreFocusOut: true,
    });
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    const clientSecret = await vscode.window.showInputBox({
      prompt: 'Enter your Atlas Client Secret',
      ignoreFocusOut: true,
    });
    if (!clientSecret) {
      throw new Error('Client Secret is required');
    }

    this._clientCreds = { clientId, clientSecret };
    // TODO: Save the client credentials somewhere for future queries so we don't need to ask for them every time
  }

  private async _getClientCreds(stream?: vscode.ChatResponseStream): Promise<{
    clientId: string;
    clientSecret: string;
  }> {
    if (!this._clientCreds) {
      await this._saveClientCredsWithInputBox(stream);
    }
    if (!this._clientCreds) {
      throw new Error('Client credentials are required');
    }
    return this._clientCreds;
  }

  private async _refreshAccessToken(
    stream?: vscode.ChatResponseStream,
  ): Promise<void> {
    const { clientId, clientSecret } = await this._getClientCreds(stream);
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to refresh access token: ${response.statusText}`);
    }
    const data = await response.json();
    this._tokenData = {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private async _makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body: any = null,
    stream?: vscode.ChatResponseStream,
  ): Promise<Response> {
    if (!this._tokenData || this._tokenData.expiresAt <= new Date()) {
      await this._refreshAccessToken(stream);
    }

    if (!this._tokenData) {
      throw new Error('Failed to refresh access token');
    }

    const url = `${BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this._tokenData.accessToken}`,
        Accept: ACCEPT_HEADER,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    };

    return fetch(url, options);
  }

  async fetchSchemaAdvice(
    groupId: string,
    clusterName: string,
    stream?: vscode.ChatResponseStream,
  ): Promise<any /* TODO */> {
    const endpoint = `groups/${groupId}/clusters/${clusterName}/performanceAdvisor/schemaAdvice`;
    const response = await this._makeRequest(
      endpoint,
      'GET',
      undefined,
      stream,
    );
    if (!response.ok) {
      const body = await response.text();
      log.error('Failed to fetch schema advice', {
        statusText: response.statusText,
        body,
      });
      throw new Error(`Failed to fetch schema advice: ${response.statusText}`);
    }
    return await response.json();
  }
}
