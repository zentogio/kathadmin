import type { APIRoute } from 'astro';
import { getOrders, saveOrders, type OrderStatus } from '../../../../lib/store';

export const prerender = false;

const VALID_STATUSES: OrderStatus[] = ['pending', 'awaiting-verification', 'paid', 'shipped', 'done'];

export const POST: APIRoute = async ({ params, request, redirect }) => {
	const form = await request.formData();
	const status = String(form.get('status') ?? '');
	if (!VALID_STATUSES.includes(status as OrderStatus)) {
		return redirect('/orders');
	}

	const orders = await getOrders();
	const order = orders.find((o) => o.orderId === params.orderId);
	if (order) {
		order.status = status as OrderStatus;
		order.read = true;
		await saveOrders(orders);
	}
	return redirect('/orders');
};
