
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
	VECTORIZE_INDEX: any;
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
		} else if (request.method === 'POST' && request.url.includes('/vectorize')) {
			return vectorizeText(request, env);
		} else if (request.method === 'POST' && request.url.includes('/ask-me-anything')) {
			return askMeAnythingQuery(request, env);
		} else {
			return new Response('Not found', { status: 404 });
		}
	},
};

async function handleFileUpload(request: any, env: Env) {
	const body = await request.json();
	const pdfUrl = body.url;
	const response = await fetch(`https://api.ocr.space/parse/imageurl?apikey=${env.OCR_API_KEY || ""}&filetype=PDF&url=${pdfUrl || ""}`);
	const results = await response.text();
	return Response.json({ response: results }, { status: 200, headers: headers});
}

async function handleAudioRequest(request: Request, env: Env) {
	const aiModel = "@cf/openai/whisper";
	const body: any = await request.json();
	const audioUrl = body.url;
	const res: any = await fetch(audioUrl);
	const blob = await res.arrayBuffer();
	const input = {
		audio: [...new Uint8Array(blob)],
	};
	const ai = new Ai((env as any).AI);

	const response = await ai.run(aiModel, input);
	return Response.json(response.text, { status: 200, headers: headers});
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

async function handleImageRequest(request :Request, env :Env) {
	const aiModel = "@cf/unum/uform-gen2-qwen-500m";
	const body: any = await request.json();
	const imageUrl = body.url;
  
	const res: any = await fetch(imageUrl);
	const buffer = await res.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	const input = {
		image: [...bytes],
		prompt: "",
		max_tokens: 1024,
	  };
	
	const ai = new Ai((env as any).AI);

	const response = await ai.run(aiModel, input);
	return Response.json(response.description, { status: 200, headers: headers});
}

// async function handleImageRequest(request: any, env: Env) {
// 	const MODEL_NAME = "gemini-1.0-pro-vision-latest";
// 	// const MODEL_NAME = "gemini-1.5-pro-latest";
// 	const API_KEY = env.GEMINI_API_KEY;

// 	// const imageUrl =
// 	// 	"https://live.staticflickr.com/745/31477937924_570eecaf85_z.jpg";
// 	const body = await request.json();
// 	const imageUrl = body.url;
// 	const genAI = new GoogleGenerativeAI(API_KEY);
// 	const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// 	const generationConfig = {
// 		temperature: 0.4,
// 		topK: 32,
// 		topP: 1,
// 		maxOutputTokens: 4096,
// 	};
// 	const imageData = await fetchAndConvertToBase64(imageUrl);
// 	const parts = [
// 		{
// 			inlineData: {
// 				mimeType: "image/jpeg",
// 				data: imageData,
// 			},
// 		},
// 	];

// 	const result = await model.generateContent({
// 		contents: [{ role: "user", parts }],
// 		generationConfig,
// 		safetySettings: [],
// 	});

// 	const response = result.response.text();
// 	console.log(response);

// 	return new Response(response, { status: 200, headers: headers});
// }

async function handleUploadRequest(request: Request, env: Env, S3: any) {
	const key = generateKeyFromRequestURL(request);
	const uploadURL = await getSignedUrl(S3, new PutObjectCommand({ Bucket: 'cf-hackathon-ai', Key: key }), { expiresIn: 3600 })

	return new Response(JSON.stringify({ key, uploadURL }), {
		headers: {
			'Content-Type': 'application/json', 
			...headers
		},
	});
}

async function handleDownloadRequest(request: Request, env: Env, S3: any) {
	const key = generateKeyFromRequestURL(request);
	const downloadURL = await getSignedUrl(S3, new GetObjectCommand({ Bucket: 'cf-hackathon-ai', Key: key }), { expiresIn: 3600 })

	return new Response(downloadURL, { status: 200, headers: headers});
}

async function summarizeAllData(request: Request, env: Env, S3: any) {
	// const summarizeModel = "@cf/facebook/bart-large-cnn";
	const summarizeModel = "@cf/qwen/qwen1.5-14b-chat-awq";
	const key = generateKeyFromRequestURL(request);
	const downloadURL = await getSignedUrl(S3, new GetObjectCommand({ Bucket: 'cf-hackathon-ai', Key: key }), { expiresIn: 3600 })
	const userFileData = await fetch(downloadURL);
	const results = await userFileData.text();
	let paraText = "";
	const dataSet = await JSON.parse(results).dataSet;
	dataSet.forEach((element :any) => {
		paraText += element.extractedText + "\n";
	});
	console.log("results", paraText)
	// const input = {
	// 	input_text: paraText,
	// 	max_length: 10000
	// };
	const messages = [
		{ role: "system", content: "Help me summarize the following text, ensure it is in paragraph style, in a formal tone and in long sentence.⁠" },
		{
		  role: "user",
		  content: paraText,
		},
	  ];
	const ai = new Ai((env as any).AI);

	const summary = await ai.run(summarizeModel, {messages});
	return Response.json(summary , { status: 200, headers: headers});
}

async function vectorizeText(request: Request, env :Env) {
	const body = await request.json();
	const  { userId, extractedText, id } = (body as any);
	const embeddings = await generateTextEmbedding(extractedText, env)

	const vectorInput = [
		{
			id: id,
			values: embeddings.data[0],
			namespace: userId,
			metadata: {
				userId, 
				extractedText,
			}
		}
	]
	const inserted = await env.VECTORIZE_INDEX.insert(vectorInput);
	return Response.json(inserted, { status: 200, headers: headers});
}

async function askMeAnythingQuery(request: Request, env :Env) {
	const summarizeModel = "@cf/qwen/qwen1.5-14b-chat-awq";
	const body: any = await request.json();
	const { question, userId } = body;
	const embeddedQuestion = await generateTextEmbedding(question, env);
	const inserted = await env.VECTORIZE_INDEX.query(embeddedQuestion.data[0], {
		topK: 1,
		returnValues: true,
		returnMetadata: true,
		namespace: userId,
	  });
	// const prompt = `Please find the below paragraph as context ${inserted.matches[0].metadata.extractedText}.
	// and help me find the answer for this question ${question}`

	// return Response.json(inserted.matches[0].metadata);
	console.log(inserted.matches[0].metadata.extractedText)
	const messages = [
		{ role: "system", content: `Please find the below paragraph as context ${inserted.matches[0].metadata.extractedText}. And this for QnA Section, answer the below question based on given context in formal tone and keep the answer precise.`},
		{
			role: "user",
			content: `Question: ${question}`,
		},
	];
	const ai = new Ai((env as any).AI);

	const summary = await ai.run(summarizeModel, {messages});
	
	return Response.json(summary, { status: 200, headers: headers});
}



const generateTextEmbedding = async (extractedText: string, env: Env) => {
	const embeddingModel = "@cf/baai/bge-base-en-v1.5";
	const ai = new Ai((env as any).AI);
	const embeddings = await ai.run(
		embeddingModel,
		
		{
		  text: [extractedText],
		}
	  );
	return embeddings;
}

function generateKeyFromRequestURL(request: Request) {
	const url = new URL(request.url);
	return url.pathname.split("/")[2];
}

function generateDocumentId() {
	const documentId = nanoid();
	return documentId;
}