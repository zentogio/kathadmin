#!/usr/bin/env node
// One-time migration: copies data/*.json + public/uploads/* into a fresh
// Supabase project (run supabase/schema.sql there first).
//
// Usage (from kath-admin/):
//   node scripts/migrate-to-supabase.mjs
//
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env in this
// directory. Safe to re-run — everything is upserted, not inserted blind.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function loadEnv() {
	const raw = await readFile(path.join(ROOT, '.env'), 'utf-8').catch(() => '');
	const env = {};
	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
	}
	return env;
}

async function uploadImage(supabase, bucket, localImagePath) {
	// localImagePath looks like "/uploads/products/trousers-sand.webp" —
	// resolve it against public/, upload under its existing basename.
	const diskPath = path.join(ROOT, 'public', localImagePath.replace(/^\//, ''));
	const bytes = await readFile(diskPath).catch(() => null);
	if (!bytes) {
		console.warn(`  ! skipping missing local file: ${diskPath}`);
		return localImagePath; // leave whatever was there so migration doesn't crash
	}
	const filename = path.basename(diskPath);
	const ext = filename.split('.').pop()?.toLowerCase();
	const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
	const { error } = await supabase.storage.from(bucket).upload(filename, bytes, {
		contentType,
		upsert: true,
	});
	if (error) throw error;
	return supabase.storage.from(bucket).getPublicUrl(filename).data.publicUrl;
}

async function main() {
	const env = await loadEnv();
	const url = env.SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key || url.includes('your-project-ref')) {
		console.error(
			'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in .env — fill those in first (see .env.example).',
		);
		process.exit(1);
	}
	const supabase = createClient(url, key, { auth: { persistSession: false } });

	console.log('Migrating products...');
	const products = JSON.parse(await readFile(path.join(ROOT, 'data', 'products.json'), 'utf-8').catch(() => '[]'));
	for (const product of products) {
		const imageUrl = await uploadImage(supabase, 'product-images', product.image);
		const { error } = await supabase
			.from('products')
			.upsert(
				{
					id: product.id,
					name: product.name,
					price: product.price,
					stock: product.stock,
					image: imageUrl,
					details: product.details,
					sold_out: product.soldOut,
				},
				{ onConflict: 'id' },
			);
		if (error) throw error;
		console.log(`  ✓ ${product.id}`);
	}

	console.log('Migrating orders...');
	const orders = JSON.parse(await readFile(path.join(ROOT, 'data', 'orders.json'), 'utf-8').catch(() => '[]'));
	if (orders.length > 0) {
		const { error } = await supabase.from('orders').upsert(
			orders.map((order) => ({
				order_id: order.orderId,
				items: order.items,
				total: order.total,
				contact: order.contact,
				status: order.status,
				read: order.read,
				created_at: order.createdAt,
			})),
			{ onConflict: 'order_id' },
		);
		if (error) throw error;
		console.log(`  ✓ ${orders.length} order(s)`);
	}

	console.log('Migrating site content...');
	const siteContent = JSON.parse(
		await readFile(path.join(ROOT, 'data', 'site-content.json'), 'utf-8').catch(() => 'null'),
	);
	if (siteContent?.home) {
		const heroImages = await Promise.all(
			siteContent.home.heroImages.map((src) => uploadImage(supabase, 'site-images', src)),
		);
		const { error } = await supabase
			.from('site_content')
			.upsert({ key: 'home', value: { ...siteContent.home, heroImages } }, { onConflict: 'key' });
		if (error) throw error;
		console.log('  ✓ home content');
	}

	console.log('\nDone. Verify in the Supabase dashboard (Table Editor), then restart the admin app.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
