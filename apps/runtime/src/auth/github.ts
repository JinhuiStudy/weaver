/**
 * GitHub OAuth v1 — authorize URL + code→token + profile fetch.
 *
 * Pure functions on top of `fetch`. `fetchImpl` is injectable so integration
 * tests can replay canned responses without hitting github.com. In production
 * the default `fetch` is the Workers runtime's — no node-fetch, no axios.
 */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const API_USER = "https://api.github.com/user";
const API_USER_EMAILS = "https://api.github.com/user/emails";

const DEFAULT_SCOPE = "read:user user:email";
const USER_AGENT = "weaver-runtime";

export type GithubProfile = {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
};

export function buildAuthorizeUrl(params: {
  clientId: string;
  state: string;
  redirectUri: string;
  scope?: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", params.scope ?? DEFAULT_SCOPE);
  return url.toString();
}

export async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`github token exchange failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (body.error) {
    throw new Error(
      `github oauth error: ${body.error}${body.error_description ? ` — ${body.error_description}` : ""}`,
    );
  }
  if (!body.access_token) {
    throw new Error("github token response missing access_token");
  }
  return { accessToken: body.access_token };
}

export async function fetchGithubProfile(params: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<GithubProfile> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const headers = {
    authorization: `Bearer ${params.accessToken}`,
    accept: "application/vnd.github+json",
    "user-agent": USER_AGENT,
  };

  const userRes = await fetchImpl(API_USER, { headers });
  if (!userRes.ok) {
    throw new Error(`github /user failed: HTTP ${userRes.status}`);
  }
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
  };

  let email: string | null = user.email ?? null;
  if (!email) {
    const emailsRes = await fetchImpl(API_USER_EMAILS, { headers });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }
  }

  return {
    id: user.id,
    login: user.login,
    email,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}
