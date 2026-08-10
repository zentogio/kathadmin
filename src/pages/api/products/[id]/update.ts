import type { APIRoute } from 'astro';
import { getProduct, upsertProduct, saveProductImage, type Product } from '../../../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, redirect }) => {
	const existing = params.id ? await getProduct(params.id) : null;
	if (!existing) return redirect('/products');

	const form = await request.formData();
	const name = String(form.get('name') ?? '').trim();
	const price = Number(form.get('price'));
	const stock = Number(form.get('stock'));
	const details = String(form.get('details') ?? '').trim();
	const soldOut = form.get('soldOut') === 'on';
	const imageFile = form.get('image');

	if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) {
		return redirect(`/products/${existing.id}/edit?error=1`);
	}

	let image = existing.image;
	if (imageFile instanceof File && imageFile.size > 0) {
		image = await saveProductImage(imageFile);
	}

	const product: Product = { id: existing.id, name, price, stock, details, image, soldOut };
	await upsertProduct(product);

	return redirect('/products');
};
