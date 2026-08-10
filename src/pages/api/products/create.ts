import type { APIRoute } from 'astro';
import { upsertProduct, generateProductId, saveProductImage, type Product } from '../../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
	const form = await request.formData();
	const name = String(form.get('name') ?? '').trim();
	const price = Number(form.get('price'));
	const stock = Number(form.get('stock'));
	const details = String(form.get('details') ?? '').trim();
	const soldOut = form.get('soldOut') === 'on';
	const imageFile = form.get('image');

	if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) {
		return redirect('/products/new?error=1');
	}
	if (!(imageFile instanceof File) || imageFile.size === 0) {
		return redirect('/products/new?error=1');
	}

	const id = await generateProductId();
	const image = await saveProductImage(imageFile);

	const product: Product = { id, name, price, stock, details, image, soldOut };
	await upsertProduct(product);

	return redirect('/products');
};
