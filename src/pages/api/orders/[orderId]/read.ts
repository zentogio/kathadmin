import type { APIRoute } from 'astro';
import { getOrders, saveOrders } from '../../../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ params, redirect }) => {
	const orders = await getOrders();
	const order = orders.find((o) => o.orderId === params.orderId);
	if (order) {
		order.read = true;
		await saveOrders(orders);
	}
	return redirect('/orders');
};
