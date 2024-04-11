

async function handleFileUpload(event) {
    const files = document.getElementById('upload-file').files;// getting our files after upload
    // const formData = new FormData() // create formData

    const data  = await fetch("https://medical-ai.sanjay-sekaren.workers.dev/upload/senthilbalaji@gmail.com",{
        method: "POST"
    });
    console.log(data)
}