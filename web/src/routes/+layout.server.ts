import type { LayoutServerLoad } from './$types';
import { PUBLIC_ELECTRIC_URL, PUBLIC_ELECTRIC_API_SECRET } from '$env/static/public';

export const load: LayoutServerLoad = async () => {
  console.log('Server env:', {
    url: PUBLIC_ELECTRIC_URL,
    secret: PUBLIC_ELECTRIC_API_SECRET ? 'SET' : 'NOT SET',
  });

  return {
    publicElectricUrl: PUBLIC_ELECTRIC_URL,
    publicElectricSecret: PUBLIC_ELECTRIC_API_SECRET,
  };
};
