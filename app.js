const express = require("express");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");
const fetch = require("node-fetch");
const fs = require("fs");

dotenv.config();

const app = express();
const port = 3000;
const LINKEDIN_API_URL = "https://api.linkedin.com/rest";

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.post("/post-to-linkedin", upload.single("image"), async (req, res) => {
  const { text } = req.body;
  const accessToken = process.env.ACCESS_TOKEN || "";
  const companyID = process.env.COMPANY_ID;

  console.log("Starting LinkedIn post process...");
  console.log("Company ID:", companyID);
  console.log(
    "Access Token (first 10 chars):",
    accessToken.substring(0, 10) + "..."
  );

  try {
    // Step 1: Initialize Image Upload
    console.log("Initializing image upload...");
    const initializeUploadResponse = await fetch(
      `${LINKEDIN_API_URL}/images?action=initializeUpload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202310",
        },
        body: JSON.stringify({
          initializeUploadRequest: {
            owner: `urn:li:organization:${companyID}`,
          },
        }),
      }
    );

    console.log(
      "Initialize Upload Response Status:",
      initializeUploadResponse.status
    );
    console.log(
      "Initialize Upload Response Status Text:",
      initializeUploadResponse.statusText
    );

    if (!initializeUploadResponse.ok) {
      const errorBody = await initializeUploadResponse.text();
      console.error("Full error response:", errorBody);
      throw new Error(
        `Image upload initialization failed: ${initializeUploadResponse.statusText}. Details: ${errorBody}`
      );
    }

    const initializeUploadData = await initializeUploadResponse.json();
    console.log(
      "Initialize Upload Response Data:",
      JSON.stringify(initializeUploadData, null, 2)
    );

    const { uploadUrl, image: imageUrn } = initializeUploadData.value;

    // Step 2: Upload the Image
    console.log("Uploading image...");
    const imageBuffer = fs.readFileSync(req.file.path);
    const uploadImageResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: imageBuffer,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Upload Image Response Status:", uploadImageResponse.status);
    console.log(
      "Upload Image Response Status Text:",
      uploadImageResponse.statusText
    );

    if (!uploadImageResponse.ok) {
      const errorBody = await uploadImageResponse.text();
      console.error("Full error response:", errorBody);
      throw new Error(
        `Image upload failed: ${uploadImageResponse.statusText}. Details: ${errorBody}`
      );
    }

    // Step 3: Create the post with the uploaded image
    console.log("Creating post...");
    const postData = {
      author: `urn:li:organization:${companyID}`,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: imageUrn,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    console.log("Post Data:", JSON.stringify(postData, null, 2));

    const createPostResponse = await fetch(`${LINKEDIN_API_URL}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202310",
      },
      body: JSON.stringify(postData),
    });

    console.log("Create Post Response Status:", createPostResponse.status);
    console.log(
      "Create Post Response Status Text:",
      createPostResponse.statusText
    );

    if (!createPostResponse.ok) {
      const errorBody = await createPostResponse.text();
      console.error("Full error response:", errorBody);
      throw new Error(
        `Post creation failed: ${createPostResponse.statusText}. Details: ${errorBody}`
      );
    }

   /*  const postResult = await createPostResponse.json();
    console.log("Created post ID:", postResult.id);
    res.send("Image post successful"); */

    // Clean up the temporary uploaded file
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error("Error posting to LinkedIn:", error);
    res.status(500).send("Error posting to LinkedIn: " + error.message);
    // Clean up the temporary uploaded file in case of error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
