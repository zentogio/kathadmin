import type { APIRoute } from 'astro';
import { deleteProduct } from '../../../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ params, redirect }) => {
	if (params.id) await deleteProduct(params.id);
	return redirect('/products?deleted=1');
};
