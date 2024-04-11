
import { Ai } from '@cloudflare/ai';
import { nanoid } from 'nanoid';
import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Env {
	ACCOUNT_ID: any;
	ACCESS_KEY_ID: any;
	SECRET_ACCESS_KEY: any;
	OCR_API_KEY: any;
	GEMINI_API_KEY: any;
	GEMINI_1_PRO_MODEL: any;
	GEMINI_1_5_PRO_MODEL: any;
}
const headers =  {
	'Access-Control-Allow-Methods': '*',
	"Access-Control-Allow-Headers" : "*",
	"Access-Control-Allow-Origin": "*",
}
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const S3 = new S3Client({
			region: "auto",
			endpoint: `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: env.ACCESS_KEY_ID || "",
				secretAccessKey: env.SECRET_ACCESS_KEY || "",
			},
		});
		const url = new URL(request.url);
		const path = url.pathname;
		console.log(path)
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'PUT',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Access-Control-Max-Age': '86400', // 24 hours
				},
			});
		}

		if (request.method === 'POST' && request.url.includes('/upload/')) {
			return handleUploadRequest(request, env, S3);
		} else if (request.method === 'GET' && request.url.includes('/download/')) {
			return handleDownloadRequest(request, env, S3);
		} else if (request.method === 'POST' && request.url.includes('/extract-pdf')) {
			return handleFileUpload(request, env);
		} else if (request.method === 'POST' && request.url.includes('/extract-image')) {
			return handleImageRequest(request, env);
		} else if (request.method === 'POST' && request.url.includes('/extract-audio')) {
			return handleAudioRequest(request, env);
		} else if (request.method === 'GET' && request.url.includes('/summarize-all-data/')) {
			return summarizeAllData(request, env, S3);
		} else {
			return new Response('Not found', { status: 404 });
		}
	},
};

async function handleFileUpload(request: any, env: Env) {
	const body = await request.json();
	const pdfUrl = body.pdfUrl;
	const response = await fetch(`https://api.ocr.space/parse/imageurl?apikey=${env.OCR_API_KEY || ""}&filetype=PDF&url=${pdfUrl || ""}`);
	const results = await response.text();
	return Response.json({ response: results }, { status: 200, headers: headers});
}

async function handleAudioRequest(request: Request, env: Env) {
	const aiModel = "@cf/openai/whisper";
	const body: any = await request.json();
	const audioUrl = body.audioUrl;
	const res: any = await fetch(audioUrl);
	const blob = await res.arrayBuffer();
	const input = {
		audio: [...new Uint8Array(blob)],
	};
	const ai = new Ai((env as any).AI);

	const response = await ai.run(aiModel, input);
	return Response.json({ response }, { status: 200, headers: headers});
}

async function fetchAndConvertToBase64(imageUrl: any) {
	try {
		const response: any = await fetch(imageUrl);
		const buffer = await response.arrayBuffer();
		const base64String = Buffer.from(buffer, "binary").toString(
			"base64"
		);
		return base64String;
	} catch (error) {
		throw error;
	}
}

async function handleImageRequest(request: any, env: Env) {
	const MODEL_NAME = env.GEMINI_1_PRO_MODEL;
	// const MODEL_NAME = env.GEMINI_1_5_PRO_MODEL;
	const API_KEY = env.GEMINI_API_KEY;

	// const imageUrl =
	// 	"https://live.staticflickr.com/745/31477937924_570eecaf85_z.jpg";
	const body = await request.json();
	const imageUrl = body.imageUrl;
	const genAI = new GoogleGenerativeAI(API_KEY);
	const model = genAI.getGenerativeModel({ model: MODEL_NAME });

	const generationConfig = {
		temperature: 0.4,
		topK: 32,
		topP: 1,
		maxOutputTokens: 4096,
	};
	const imageData = await fetchAndConvertToBase64(imageUrl);
	const parts = [
		{
			inlineData: {
				mimeType: "image/jpeg",
				data: imageData,
			},
		},
	];

	const result = await model.generateContent({
		contents: [{ role: "user", parts }],
		generationConfig,
		safetySettings: [],
	});

	const response = result.response.text();
	console.log(response);

	return new Response(response, { status: 200, headers: headers});
}

async function handleUploadRequest(request: Request, env: Env, S3: any) {
	const key = generateKeyFromRequestURL(request);
	const uploadURL = await getSignedUrl(S3, new PutObjectCommand({ Bucket: 'ai-storage', Key: key }), { expiresIn: 3600 })

	// Store the document ID and upload URL in a KV store
	// await env.MEDICALAI.put(documentId, uploadURL);

	return new Response(JSON.stringify({ key, uploadURL }), {
		headers: {
			'Content-Type': 'application/json', 
			...headers
		},
	});
}

async function handleDownloadRequest(request: Request, env: Env, S3: any) {
	const key = generateKeyFromRequestURL(request);
	const downloadURL = await getSignedUrl(S3, new GetObjectCommand({ Bucket: 'ai-storage', Key: key }), { expiresIn: 3600 })

	return new Response(downloadURL, { status: 200, headers: headers});
}

async function summarizeAllData(request: Request, env: Env, S3: any) {
	const summarizeModel = "@cf/facebook/bart-large-cnn";
	const key = generateKeyFromRequestURL(request);
	const downloadURL = await getSignedUrl(S3, new GetObjectCommand({ Bucket: 'ai-storage', Key: key }), { expiresIn: 3600 })
	const userFileData = await fetch(downloadURL);
	const results = await userFileData.text();
	let paraText = ""
	console.log(results, typeof results, JSON.parse(results).dataSet,"check");
	const dataSet = JSON.parse(results).dataSet;
	dataSet.forEach((element :any) => {
		console.log("ele", element)
		paraText += element.extractedText + "\n";
	});
	console.log("para",paraText)
	const input = {
		input_text: paraText,
	};
	const ai = new Ai((env as any).AI);

	const response = await ai.run(summarizeModel, input);
	return Response.json(response , { status: 200, headers: headers});
}

function generateKeyFromRequestURL(request: Request) {
	const url = new URL(request.url);
	return url.pathname.split("/")[2];
}

function generateDocumentId() {
	const documentId = nanoid();
	return documentId;
}