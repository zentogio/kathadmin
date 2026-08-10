import type { APIRoute } from 'astro';
import { getSiteContent, saveSiteContent, saveSiteImage } from '../../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
	const form = await request.formData();
	const heroHeadline = String(form.get('heroHeadline') ?? '').trim();
	const heroSubtext = String(form.get('heroSubtext') ?? '').trim();
	const removeImages = new Set(form.getAll('removeImages').map(String));
	const newImageFiles = form.getAll('newImages').filter((f): f is File => f instanceof File && f.size > 0);

	const content = await getSiteContent();
	const keptImages = content.home.heroImages.filter((src) => !removeImages.has(src));
	const addedImages = await Promise.all(newImageFiles.map((file) => saveSiteImage(file)));

	await saveSiteContent({
		home: {
			heroHeadline: heroHeadline || content.home.heroHeadline,
			heroSubtext: heroSubtext || content.home.heroSubtext,
			heroImages: [...keptImages, ...addedImages],
		},
	});

	return redirect('/content/home?saved=1');
};
