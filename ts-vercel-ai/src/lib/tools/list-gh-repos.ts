import { Octokit, RequestError } from 'octokit';
import { getAccessToken, withGitHubConnection } from '@/lib/auth0-ai';
import { tool } from 'ai';
import { z } from 'zod';

export const listRepositories = withGitHubConnection(
  tool({
    description: 'List data of all repositories for the current user on GitHub',
    inputSchema: z.object({}),
    execute: async () => {
      let accessToken: string;
      try {
        accessToken = await getAccessToken();
      } catch (error: any) {
        console.log('GitHub Token Vault connection error:', error);
        const status = error?.status ?? error?.response?.status;
        if (status === 404 || (error?.message && /404|not found/i.test(error.message))) {
          return {
            error: true,
            message:
              'GitHub not connected. Go to your Profile page to connect your GitHub account. Make sure the GitHub connection in Auth0 is configured with Purpose set to "Connected Accounts for Token Vault".',
          };
        }
        return {
          error: true,
          message: `Failed to connect to GitHub: ${error?.message ?? 'Unknown error'}. Go to your Profile page to connect your GitHub account.`,
        };
      }

      try {
        const octokit = new Octokit({
          auth: accessToken,
        });

        const { data } = await octokit.rest.repos.listForAuthenticatedUser({ visibility: 'all' });

        // Return simplified repository data to avoid overwhelming the LLM
        const simplifiedRepos = data.map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          open_issues_count: repo.open_issues_count,
          updated_at: repo.updated_at,
          created_at: repo.created_at,
        }));

        return {
          total_repositories: simplifiedRepos.length,
          repositories: simplifiedRepos,
        };
      } catch (error) {
        console.log('GitHub API error:', error);

        if (error instanceof RequestError) {
          if (error.status === 401) {
            return {
              error: true,
              message:
                'GitHub authorization expired or revoked. Go to your Profile page to reconnect your GitHub account.',
            };
          }
          if (error.status === 404) {
            return {
              error: true,
              message:
                'GitHub not connected. Go to your Profile page to connect your GitHub account.',
            };
          }
        }

        return {
          error: true,
          message: `GitHub API error: ${(error as Error)?.message ?? 'Unknown error'}. Try reconnecting your GitHub account from the Profile page.`,
        };
      }
    },
  }),
);
