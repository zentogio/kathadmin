// Supabase-backed data layer — replaces the earlier plain-JSON-file draft.
// Shared with the storefront in the sense that this is now a real database
// instead of files that only ever lived on this one machine; the storefront
// itself doesn't read from it yet (see kath's README/session notes).
//
// All calls here run server-side only (API routes, .astro frontmatter) and
// use the Supabase *service role* key, which bypasses Row Level Security —
// appropriate because this whole app is already gated behind its own login
// (see src/middleware.ts) and nothing here is ever called from the browser.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
	const url = import.meta.env.SUPABASE_URL;
	const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — check .env');
	}
	return createClient(url, key, { auth: { persistSession: false } });
}

export interface Product {
	id: string;
	name: string;
	price: number;
	stock: number;
	image: string;
	details: string;
	soldOut: boolean;
}

export interface OrderItem {
	id: string;
	name: string;
	price: number;
	qty: number;
}

export interface OrderContact {
	name: string;
	address: string;
	phone: string;
}

export type OrderStatus = 'pending' | 'awaiting-verification' | 'paid' | 'shipped' | 'done';

export interface Order {
	orderId: string;
	items: OrderItem[];
	total: number;
	contact: OrderContact;
	createdAt: string;
	status: OrderStatus;
	read: boolean;
}

// --- row <-> domain-object mapping (DB columns are snake_case) ---

interface ProductRow {
	id: string;
	name: string;
	price: number;
	stock: number;
	image: string;
	details: string;
	sold_out: boolean;
}

function productFromRow(row: ProductRow): Product {
	return {
		id: row.id,
		name: row.name,
		price: row.price,
		stock: row.stock,
		image: row.image,
		details: row.details,
		soldOut: row.sold_out,
	};
}

function productToRow(product: Product): ProductRow {
	return {
		id: product.id,
		name: product.name,
		price: product.price,
		stock: product.stock,
		image: product.image,
		details: product.details,
		sold_out: product.soldOut,
	};
}

interface OrderRow {
	order_id: string;
	items: OrderItem[];
	total: number;
	contact: OrderContact;
	created_at: string;
	status: OrderStatus;
	read: boolean;
}

function orderFromRow(row: OrderRow): Order {
	return {
		orderId: row.order_id,
		items: row.items,
		total: row.total,
		contact: row.contact,
		createdAt: row.created_at,
		status: row.status,
		read: row.read,
	};
}

function orderToRow(order: Order): OrderRow {
	return {
		order_id: order.orderId,
		items: order.items,
		total: order.total,
		contact: order.contact,
		created_at: order.createdAt,
		status: order.status,
		read: order.read,
	};
}

// --- products ---

export async function getProducts(): Promise<Product[]> {
	const { data, error } = await getSupabase()
		.from('products')
		.select('*')
		.order('created_at', { ascending: true });
	if (error) throw error;
	return (data as ProductRow[]).map(productFromRow);
}

export async function saveProducts(products: Product[]): Promise<void> {
	if (products.length === 0) return;
	const { error } = await getSupabase()
		.from('products')
		.upsert(products.map(productToRow), { onConflict: 'id' });
	if (error) throw error;
}

export async function getProduct(id: string): Promise<Product | null> {
	const { data, error } = await getSupabase().from('products').select('*').eq('id', id).maybeSingle();
	if (error) throw error;
	return data ? productFromRow(data as ProductRow) : null;
}

// Not a slug of the name — product names are often Thai, and turning
// non-Latin names into URL slugs is more trouble than it's worth (the
// whole name ends up as the "slug" with no real shortening, and it lands
// unencoded in URLs). A short random id sidesteps that entirely, the same
// way order ids already work.
export async function generateProductId(): Promise<string> {
	const supabase = getSupabase();
	let id: string;
	let exists = true;
	do {
		id = `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		const { data, error } = await supabase.from('products').select('id').eq('id', id).maybeSingle();
		if (error) throw error;
		exists = Boolean(data);
	} while (exists);
	return id;
}

// Uploads to the `product-images` Storage bucket and returns its public URL.
export async function saveProductImage(file: File): Promise<string> {
	const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
	const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
	const supabase = getSupabase();
	const { error } = await supabase.storage.from('product-images').upload(filename, file, {
		contentType: file.type || undefined,
	});
	if (error) throw error;
	return supabase.storage.from('product-images').getPublicUrl(filename).data.publicUrl;
}

export async function upsertProduct(product: Product): Promise<void> {
	const { error } = await getSupabase().from('products').upsert(productToRow(product), { onConflict: 'id' });
	if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
	const { error } = await getSupabase().from('products').delete().eq('id', id);
	if (error) throw error;
}

// --- orders ---

export async function getOrders(): Promise<Order[]> {
	const { data, error } = await getSupabase()
		.from('orders')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) throw error;
	return (data as OrderRow[]).map(orderFromRow);
}

export async function saveOrders(orders: Order[]): Promise<void> {
	if (orders.length === 0) return;
	const { error } = await getSupabase()
		.from('orders')
		.upsert(orders.map(orderToRow), { onConflict: 'order_id' });
	if (error) throw error;
}

export async function unreadOrderCount(): Promise<number> {
	const { count, error } = await getSupabase()
		.from('orders')
		.select('*', { count: 'exact', head: true })
		.eq('read', false);
	if (error) throw error;
	return count ?? 0;
}

// --- site content ---

// Non-product site copy/images — a first, narrow slice of "edit mode" for
// the storefront's Home page. Not a general page builder: just the fields
// called out explicitly (hero headline, subtext, hero images).
export interface HomeContent {
	heroHeadline: string;
	heroSubtext: string;
	heroImages: string[];
}

export interface SiteContent {
	home: HomeContent;
}

const DEFAULT_SITE_CONTENT: SiteContent = {
	home: {
		heroHeadline: 'Cut by hand.\nMade in small batches.',
		heroSubtext:
			"Every piece starts as a length of cloth and a chalk line, not a production run. We cut what we can make well, and no more.",
		heroImages: [],
	},
};

export async function getSiteContent(): Promise<SiteContent> {
	const { data, error } = await getSupabase()
		.from('site_content')
		.select('value')
		.eq('key', 'home')
		.maybeSingle();
	if (error) throw error;
	if (!data) return DEFAULT_SITE_CONTENT;
	return { home: data.value as HomeContent };
}

export async function saveSiteContent(content: SiteContent): Promise<void> {
	const { error } = await getSupabase()
		.from('site_content')
		.upsert({ key: 'home', value: content.home }, { onConflict: 'key' });
	if (error) throw error;
}

// Uploads to the `site-images` Storage bucket and returns its public URL.
export async function saveSiteImage(file: File): Promise<string> {
	const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
	const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
	const supabase = getSupabase();
	const { error } = await supabase.storage.from('site-images').upload(filename, file, {
		contentType: file.type || undefined,
	});
	if (error) throw error;
	return supabase.storage.from('site-images').getPublicUrl(filename).data.publicUrl;
}
