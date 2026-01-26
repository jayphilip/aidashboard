import type { LayoutServerLoad } from './$types';
import { PUBLIC_ELECTRIC_URL } from '$env/static/public';
import { ELECTRIC_API_SECRET, ELECTRIC_SECRET } from '$env/static/private';

export const load: LayoutServerLoad = async () => {
  const secret = ELECTRIC_API_SECRET ?? ELECTRIC_SECRET;
  console.log('Server env:', {
    url: PUBLIC_ELECTRIC_URL,
    secret: secret ? 'SET' : 'NOT SET',
  });

  return {
    publicElectricUrl: PUBLIC_ELECTRIC_URL,
    // only expose whether a secret is set — never return the secret value
    publicElectricSecret: secret ? 'SET' : null,
  };
};
