import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
  return {
    publicElectricUrl: process.env.PUBLIC_ELECTRIC_URL,
    publicElectricSecret: process.env.PUBLIC_ELECTRIC_API_SECRET,
  };
};
