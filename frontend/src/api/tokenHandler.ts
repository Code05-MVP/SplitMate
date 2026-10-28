
let getAccessToken: () => string | null = () => null;
let updateAccessToken: (token: string) => void = () => {};

export function configureTokenHandler(
  getToken: () => string | null,
  updateToken: (token: string) => void,
) {
  getAccessToken = getToken;
  updateAccessToken = updateToken;
}

export function readAccessToken() {
  return getAccessToken();
}

export function saveAccessToken(token: string) {
  updateAccessToken(token);
}
