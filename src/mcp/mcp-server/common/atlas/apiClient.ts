/* eslint-disable new-cap */
import createClient from 'openapi-fetch';
import type { FetchOptions, Client, Middleware } from 'openapi-fetch';
import type { AccessToken } from 'simple-oauth2';
import { ClientCredentials } from 'simple-oauth2';
import { ApiClientError } from './apiClientError';
import type { paths, operations } from './openapi';
import type { CommonProperties, TelemetryEvent } from '../../telemetry/types';
import { packageInfo } from '../../helpers/packageInfo';

const ATLAS_API_VERSION = '2025-03-12';

export interface ApiClientCredentials {
  clientId: string;
  clientSecret: string;
}

export interface ApiClientOptions {
  credentials?: ApiClientCredentials;
  baseUrl: string;
  userAgent?: string;
}

export class ApiClient {
  private options: {
    baseUrl: string;
    userAgent: string;
    credentials?: {
      clientId: string;
      clientSecret: string;
    };
  };
  private client: Client<paths>;
  private oauth2Client?: ClientCredentials;
  private accessToken?: AccessToken;

  private getAccessToken = async () => {
    if (
      this.oauth2Client &&
      (!this.accessToken || this.accessToken.expired())
    ) {
      this.accessToken = await this.oauth2Client.getToken({});
    }
    return this.accessToken?.token.access_token as string | undefined;
  };

  private authMiddleware: Middleware = {
    onRequest: async ({ request, schemaPath }) => {
      if (
        schemaPath.startsWith('/api/private/unauth') ||
        schemaPath.startsWith('/api/oauth')
      ) {
        return undefined;
      }

      try {
        const accessToken = await this.getAccessToken();
        request.headers.set('Authorization', `Bearer ${accessToken}`);
        return request;
      } catch {
        // ignore not availble tokens, API will return 401
      }
    },
  };

  constructor(options: ApiClientOptions) {
    this.options = {
      ...options,
      userAgent:
        options.userAgent ||
        `AtlasMCP/${packageInfo.version} (${process.platform}; ${process.arch}; ${process.env.HOSTNAME || 'unknown'})`,
    };

    this.client = createClient<paths>({
      baseUrl: this.options.baseUrl,
      headers: {
        'User-Agent': this.options.userAgent,
        Accept: `application/vnd.atlas.${ATLAS_API_VERSION}+json`,
      },
    });
    if (
      this.options.credentials?.clientId &&
      this.options.credentials?.clientSecret
    ) {
      this.oauth2Client = new ClientCredentials({
        client: {
          id: this.options.credentials.clientId,
          secret: this.options.credentials.clientSecret,
        },
        auth: {
          tokenHost: this.options.baseUrl,
          tokenPath: '/api/oauth/token',
        },
      });
      this.client.use(this.authMiddleware);
    }
  }

  public hasCredentials(): boolean {
    return !!(this.oauth2Client && this.accessToken);
  }

  public async hasValidAccessToken(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    return accessToken !== undefined;
  }

  public async getIpInfo(): Promise<{
    currentIpv4Address: string;
  }> {
    const accessToken = await this.getAccessToken();

    const endpoint = 'api/private/ipinfo';
    const url = new URL(endpoint, this.options.baseUrl);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': this.options.userAgent,
      },
    });

    if (!response.ok) {
      throw await ApiClientError.fromResponse(response);
    }

    return (await response.json()) as Promise<{
      currentIpv4Address: string;
    }>;
  }

  async sendEvents(events: TelemetryEvent<CommonProperties>[]): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': this.options.userAgent,
    };

    const accessToken = await this.getAccessToken();
    if (accessToken) {
      const authUrl = new URL(
        'api/private/v1.0/telemetry/events',
        this.options.baseUrl,
      );
      headers.Authorization = `Bearer ${accessToken}`;

      try {
        const response = await fetch(authUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(events),
        });

        if (response.ok) {
          return;
        }

        // If anything other than 401, throw the error
        if (response.status !== 401) {
          throw await ApiClientError.fromResponse(response);
        }

        // For 401, fall through to unauthenticated endpoint
        delete headers.Authorization;
      } catch (error) {
        // If the error is not a 401, rethrow it
        if (
          !(error instanceof ApiClientError) ||
          error.response.status !== 401
        ) {
          throw error;
        }

        // For 401 errors, fall through to unauthenticated endpoint
        delete headers.Authorization;
      }
    }

    // Send to unauthenticated endpoint (either as fallback from 401 or direct if no token)
    const unauthUrl = new URL(
      'api/private/unauth/telemetry/events',
      this.options.baseUrl,
    );
    const response = await fetch(unauthUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(events),
    });

    if (!response.ok) {
      throw await ApiClientError.fromResponse(response);
    }
  }

  // DO NOT EDIT. This is auto-generated code.
  async listClustersForAllProjects(
    options?: FetchOptions<operations['listClustersForAllProjects']>,
  ) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/clusters',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async listProjects(options?: FetchOptions<operations['listProjects']>) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async createProject(options: FetchOptions<operations['createProject']>) {
    const { data, error, response } = await this.client.POST(
      '/api/atlas/v2/groups',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async deleteProject(options: FetchOptions<operations['deleteProject']>) {
    const { error, response } = await this.client.DELETE(
      '/api/atlas/v2/groups/{groupId}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
  }

  async getProject(options: FetchOptions<operations['getProject']>) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async listProjectIpAccessLists(
    options: FetchOptions<operations['listProjectIpAccessLists']>,
  ) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}/accessList',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async createProjectIpAccessList(
    options: FetchOptions<operations['createProjectIpAccessList']>,
  ) {
    const { data, error, response } = await this.client.POST(
      '/api/atlas/v2/groups/{groupId}/accessList',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async deleteProjectIpAccessList(
    options: FetchOptions<operations['deleteProjectIpAccessList']>,
  ) {
    const { error, response } = await this.client.DELETE(
      '/api/atlas/v2/groups/{groupId}/accessList/{entryValue}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
  }

  async listClusters(options: FetchOptions<operations['listClusters']>) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}/clusters',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async createCluster(options: FetchOptions<operations['createCluster']>) {
    const { data, error, response } = await this.client.POST(
      '/api/atlas/v2/groups/{groupId}/clusters',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async deleteCluster(options: FetchOptions<operations['deleteCluster']>) {
    const { error, response } = await this.client.DELETE(
      '/api/atlas/v2/groups/{groupId}/clusters/{clusterName}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
  }

  async getCluster(options: FetchOptions<operations['getCluster']>) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}/clusters/{clusterName}',
      options,
    );

    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async listDatabaseUsers(
    options: FetchOptions<operations['listDatabaseUsers']>,
  ) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}/databaseUsers',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async createDatabaseUser(
    options: FetchOptions<operations['createDatabaseUser']>,
  ) {
    const { data, error, response } = await this.client.POST(
      '/api/atlas/v2/groups/{groupId}/databaseUsers',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async deleteDatabaseUser(
    options: FetchOptions<operations['deleteDatabaseUser']>,
  ) {
    const { error, response } = await this.client.DELETE(
      '/api/atlas/v2/groups/{groupId}/databaseUsers/{databaseName}/{username}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
  }

  async listFlexClusters(
    options: FetchOptions<operations['listFlexClusters']>,
  ) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}/flexClusters',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async createFlexCluster(
    options: FetchOptions<operations['createFlexCluster']>,
  ) {
    const { data, error, response } = await this.client.POST(
      '/api/atlas/v2/groups/{groupId}/flexClusters',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async deleteFlexCluster(
    options: FetchOptions<operations['deleteFlexCluster']>,
  ) {
    const { error, response } = await this.client.DELETE(
      '/api/atlas/v2/groups/{groupId}/flexClusters/{name}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
  }

  async getFlexCluster(options: FetchOptions<operations['getFlexCluster']>) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/groups/{groupId}/flexClusters/{name}',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async listOrganizations(
    options?: FetchOptions<operations['listOrganizations']>,
  ) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/orgs',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  async listOrganizationProjects(
    options: FetchOptions<operations['listOrganizationProjects']>,
  ) {
    const { data, error, response } = await this.client.GET(
      '/api/atlas/v2/orgs/{orgId}/groups',
      options,
    );
    if (error) {
      throw ApiClientError.fromError(response, error);
    }
    return data;
  }

  // DO NOT EDIT. This is auto-generated code.
}
