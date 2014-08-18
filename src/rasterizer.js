var jsRaster = jsRaster || {};

jsRaster.Rasterizer = function(canvas, enableExceptions){
	if (! (this instanceof jsRaster.Rasterizer)) {
		return new jsRaster.Rasterizer(canvas, enableExceptions);
	}
	this.canvas = canvas;
	this.context = canvas.getContext('2d');
	this.framebuffer = this.context.createImageData(canvas.width, canvas.height);
	this.width = canvas.width;
	this.height = canvas.height;
	this.depthbuffer = new Float32Array(this.width * this.height);
	this.exceptionsEnabled = enableExceptions;
	this.attributes = null;
	//Tile size base. Must be POT. TODO: Makes this configureable?
	this.Q = 3;
	//Actual Tile size
	this.q = (1<<this.Q);
};


jsRaster.Rasterizer.prototype.clipSingle = function(){

};

/* Perform clipping in clipspace before perspective divide */
jsRaster.Rasterizer.prototype.clipping = function(){
	
};

jsRaster.Rasterizer.prototype.project = function(v){
	var proj,
	centerX = this.width*0.5,
	centerY = this.height*0.5,
	wInv = 1.0 / v[3];

	/* perspective divide */
	proj = vec4.fromValues(v[0] * wInv, v[1] * wInv, v[2] * wInv, wInv);
	proj[0] = proj[0]*centerX + centerX;
	proj[1] = proj[1]*centerY + centerY;
	proj[2] = proj[2]*0.5 + 0.5;
	proj[3] = v[3]; //wInv;
	return proj;
};

jsRaster.Rasterizer.prototype.rasterize = function(pixelCallback){
	var v1,v2,v3;
	var attribs = {};
	var i,x,y;
	var col;
	var ix, iy;
	var pixel;

	for(i = 0; i < this.attributes.length; i+=3){
		v1 = this.attributes[i + 0]["jsRasterPosition"];
		v2 = this.attributes[i + 1]["jsRasterPosition"];
		v3 = this.attributes[i + 2]["jsRasterPosition"];

		var X1 = (16.0 * v1[0])<<0;
		var X2 = (16.0 * v2[0])<<0;
		var X3 = (16.0 * v3[0])<<0;
		var Y1 = (16.0 * v1[1])<<0;
		var Y2 = (16.0 * v2[1])<<0;
		var Y3 = (16.0 * v3[1])<<0;

		// Deltas
		var DX12 = X1 - X2;
		var DX23 = X2 - X3;
		var DX31 = X3 - X1;
		var DY12 = Y1 - Y2;
		var DY23 = Y2 - Y3;
		var DY31 = Y3 - Y1;

		// Fixed-point deltas
		var FDX12 = DX12 << 4;
		var FDX23 = DX23 << 4;
		var FDX31 = DX31 << 4;
		var FDY12 = DY12 << 4;
		var FDY23 = DY23 << 4;
		var FDY31 = DY31 << 4;

		// Bounding rectangle
		var minx = (Math.min(X1, Math.min(X2, X3)) + 0xF) >> 4;
		var maxx = (Math.max(X1, Math.max(X2, X3)) + 0xF) >> 4;
		var miny = (Math.min(Y1, Math.min(Y2, Y3)) + 0xF) >> 4;
		var maxy = (Math.max(Y1, Math.max(Y2, Y3)) + 0xF) >> 4;

		// Start in corner of a qxq block aligned to the screen
		minx &= ~(this.q - 1);
		miny &= ~(this.q - 1);
		maxx = (maxx + (this.q - 1)) & ~(this.q - 1);
		maxy = (maxy + (this.q - 1)) & ~(this.q - 1);

		// Half-edge constants
		var C1 = DY12 * X1 - DX12 * Y1;
		var C2 = DY23 * X2 - DX23 * Y2;
		var C3 = DY31 * X3 - DX31 * Y3;

		// Correct for fill convention
		if(DY12 < 0 || (DY12 == 0 && DX12 > 0)) C1++;
		if(DY23 < 0 || (DY23 == 0 && DX23 > 0)) C2++;
		if(DY31 < 0 || (DY31 == 0 && DX31 > 0)) C3++;

		for(y = miny; y < maxy; y += this.q) {
			for(x = minx; x < maxx; x += this.q) {

				// Corners of block
				var x0 = x;
				var x1 = (x + this.q - 1);
				var y0 = y;
				var y1 = (y + this.q - 1);

				// test block against x and y frustum planes
				var px0min = x0 >= 0;
				var px0max = x0 < this.width;
				var py0min = y0 >= 0;
				var py0max = y0 < this.height;

				var px1min = x1 >= 0;
				var px1max = x1 < this.width;
				var py1min = y1 >= 0;
				var py1max = y1 < this.height;

				var pflags0 = (px0min << 3) | (px1min << 2) | (px0max << 1) | px1max;
				var pflags1 = (py0min << 3) | (py1min << 2) | (py0max << 1) | py1max;

				var pflags = (pflags0<<4) | pflags1;

				if(pflags != 0xFF)
					continue;

				x0 <<= 4;
				x1 <<= 4;
				y0 <<= 4;
				y1 <<= 4;

				// Evaluate half-space functions
				var a00 = (C1 + DX12 * y0 - DY12 * x0) > 0;
				var a10 = (C1 + DX12 * y0 - DY12 * x1) > 0;
				var a01 = (C1 + DX12 * y1 - DY12 * x0) > 0;
				var a11 = (C1 + DX12 * y1 - DY12 * x1) > 0;

				var a = (a00 << 0) | (a10 << 1) | (a01 << 2) | (a11 << 3);

				var b00 = (C2 + DX23 * y0 - DY23 * x0) > 0;
				var b10 = (C2 + DX23 * y0 - DY23 * x1) > 0;
				var b01 = (C2 + DX23 * y1 - DY23 * x0) > 0;
				var b11 = (C2 + DX23 * y1 - DY23 * x1) > 0;

				var b = (b00 << 0) | (b10 << 1) | (b01 << 2) | (b11 << 3);

				var c00 = (C3 + DX31 * y0 - DY31 * x0) > 0;
				var c10 = (C3 + DX31 * y0 - DY31 * x1) > 0;
				var c01 = (C3 + DX31 * y1 - DY31 * x0) > 0;
				var c11 = (C3 + DX31 * y1 - DY31 * x1) > 0;

				var c = (c00 << 0) | (c10 << 1) | (c01 << 2) | (c11 << 3);

				// Skip block when outside an edge
				if(a == 0x0 || b == 0x0 || c == 0x0) continue;

				//full cover
				if(a == 0xF && b == 0xF && c == 0xF){
					col  = y*this.width;					
					for(iy = y; iy < y + this.q; iy++){						
						for(ix = x; ix < x + this.q; ix++){
							pixel = pixelCallback();
							this.framebuffer.data[(col + ix)*4 + 0] = (pixel[0] << 8) - (pixel[0] << 0);
							this.framebuffer.data[(col + ix)*4 + 1] = (pixel[1] << 8) - (pixel[1] << 0);
							this.framebuffer.data[(col + ix)*4 + 2] = (pixel[2] << 8) - (pixel[2] << 0);
							this.framebuffer.data[(col + ix)*4 + 3] = (pixel[3] << 8) - (pixel[3] << 0);
						}
						col += this.width;
					}
				} else { //partial cover
					var CY1 = C1 + DX12 * y0 - DY12 * x0;
					var CY2 = C2 + DX23 * y0 - DY23 * x0;
					var CY3 = C3 + DX31 * y0 - DY31 * x0;
					col = y*this.width;
					for(iy = y; iy < y + this.q; iy++){
						var CX1 = CY1;
						var CX2 = CY2;
						var CX3 = CY3;
						for(ix = x; ix < x + this.q; ix++){
							if(CX1 > 0 && CX2 > 0 && CX3 > 0) {
								pixel = pixelCallback();
								this.framebuffer.data[(col + ix)*4 + 0] = (pixel[0] << 8) - (pixel[0] << 0);
								this.framebuffer.data[(col + ix)*4 + 1] = (pixel[1] << 8) - (pixel[1] << 1);
								this.framebuffer.data[(col + ix)*4 + 2] = (pixel[2] << 8) - (pixel[2] << 2);
								this.framebuffer.data[(col + ix)*4 + 3] = (pixel[3] << 8) - (pixel[3] << 3);
							}
							CX1 -= FDY12;
							CX2 -= FDY23;
							CX3 -= FDY31;
						}
						col += this.width;
						CY1 += FDX12;
						CY2 += FDX23;
						CY3 += FDX31;
					}
				}
			}
		}
	}
};

jsRaster.Rasterizer.prototype.computecoeffs = function(){
	/* For perspective correct interpolation, we generate coefficients this way:
	 Let s1, s2 and s3 be the vertex-values at each triangle corner. We gather these and make a 3D vector out of them. The vector represents
	 a single value we want to interpolate over the triangle. Let's call that value 's'.
	 We multiply the 3D vector [s1, s2, s3] by the coefficient matrix above to get p. We call the coefficients in p for A, B and C such that
	 the following equation holds:
	 
	 s/w = Ax + By + C
	 
	 X and Y here are normalized device coordinates. Then to get the interpolated s for a pixel, we compute s/w as above and multiply by 1/w.
	 w in 1/w is also interpolated across the triangle. In general you can visualize the matrix multiplication as dividing the scalar by w.
	 To get the A,B,C coefficients for w then, you multiply the vector [1,1,1] by the coefficient matrix.
	 
	 At last, since x and y have to be in NDC space, one has to convert x and y from screen space into NDC space. One can do that this way:
	 x' = x*(1/(halfwidth-1)) - 1
	 y' = y*(1/(halfheight-1)) - 1
	 
		 The scaling transforms x and y into the range [0,2], and subtracting 1 puts the coordinates into [-1,1] range.
	 NOTE: z needs linear interpolation, so to interpolate z correctly multiply [z1*w, z2*w, z3*w] with the matrix to cancel out the division.
	 */

	var i,j;
	var v1,v2,v3;
	var s1, s2, s3;
	var ABC;
	var coeffMatrix = mat3.create();
	var len = 0;
	var that = this;

	for(i = 0; i < this.attributes.length; i += 3){
		v1 = this.attributes[i + 0]["jsRasterPosition"];
		v2 = this.attributes[i + 1]["jsRasterPosition"];
		v3 = this.attributes[i + 2]["jsRasterPosition"];

		coeffMatrix[0] = v1[0];
		coeffMatrix[1] = v1[1];
		coeffMatrix[2] = v1[3];
		coeffMatrix[3] = v2[0];
		coeffMatrix[4] = v2[1];
		coeffMatrix[5] = v2[3];
		coeffMatrix[6] = v3[0];
		coeffMatrix[7] = v3[1];
		coeffMatrix[8] = v3[3];

		coeffMatrix = mat3.invert(coeffMatrix, coeffMatrix);

		/* TODO: If the matrix is degenerate, the triangle is degenerate. We should really remove it from the list.
		 Instead we clearly mark the triangle as degenerate by giving it zero area. */
		if(coeffMatrix === null){
			v1[0] = 0;
			v1[1] = 0;
			v1[2] = 0;
			v1[3] = 1;
			v2[0] = 0;
			v2[1] = 0;
			v2[2] = 0;
			v2[3] = 1;
			v3[0] = 0;
			v3[1] = 0;
			v1[2] = 0;
			v3[3] = 1;
			continue;
		}

		/* Convert x and y into screenspace, scale and bias z  to [0, 1> range */
		v1 = this.project(v1);
		v2 = this.project(v2);
		v3 = this.project(v3);

		/* Compute A,B,C coeffs for z z1*w1, z2*w2, z3*w3 */
		ABC = vec3.fromValues(v1[2] * v1[3], v2[2] * v2[3], v3[2] * v3[3]);
		ABC = vec3.transformMat3(ABC, ABC, coeffMatrix);
		/* Copy them back */
		v1[2] = ABC[0];
		v2[2] = ABC[1];
		v3[2] = ABC[2];

		//Compute A,B,C coeffs for w 
		ABC = vec3.fromValues(1.0, 1.0, 1.0);
		ABC = vec3.transformMat3(ABC, ABC, coeffMatrix);
		/* Copy them back */
		v1[3] = ABC[0];
		v2[3] = ABC[1];
		v3[3] = ABC[2];

		this.attributes[i + 0].jsRasterPosition = v1;
		this.attributes[i + 1].jsRasterPosition = v2;
		this.attributes[i + 2].jsRasterPosition = v3;

		this.attributeNames.forEach(function(name){
			if(name == "jsRasterPosition"){
				return;
			}
			s1 = that.attributes[i + 0][name];
			s2 = that.attributes[i + 1][name];
			s3 = that.attributes[i + 2][name];
			if((s1 instanceof Float32Array) || (s1 instanceof Array)){			
				/* We assume all three vectors/arrays are of equal length */
				len = s1.length;
				ABC = vec3.create();
				for(j = 0; j < len; j++){
					ABC[0] = s1[j];
					ABC[1] = s2[j];
					ABC[2] = s3[j];
					ABC = vec3.transformMat3(ABC, ABC, coeffMatrix);
					that.attributes[i + 0][name][j] = ABC[0];
					that.attributes[i + 1][name][j] = ABC[1];
					that.attributes[i + 2][name][j] = ABC[2];
				}
			} else {
				/* Single scalar case */
				ABC[0] = s1[0];
				ABC[1] = s2[0];
				ABC[2] = s3[0];
				ABC = vec3.transformMat3(ABC, ABC, coeffMatrix);
				that.attributes[i + 0][name] = ABC[0];
				that.attributes[i + 1][name] = ABC[1];
				that.attributes[i + 2][name] = ABC[2];
			}
		});
	}
};

jsRaster.Rasterizer.prototype.flip = function() {
	this.context.putImageData(this.framebuffer, 0, 0);
};

/*
 attributes is a homogenous array of objects containing vertex attributes like color, normals, texture coordinates, etc
 attributeNames is an array of strings which are the name of the properties of the elements of the array "attributes"
 uniforms is an object of various objects that are constant for a whole batch, i.e not per-vertex
 uniformNames is an array of strings which are the name of the properties in "uniforms"
 vertexCallback is the "vertex shader" callback function: function(vertexIn, api){ ... return vertexOut; }
 pixelCallback is the "pixel shader" callback function: function(fragmentIn, api){ ... return vec4.fromValues(...); }
 */
jsRaster.Rasterizer.prototype.clear = function() {
	var x,y, idx;

	for(y = 0; y < this.height; y++){
		for(x = 0; x < this.width; x++){
			idx = (x + y*this.width)*4;
			this.framebuffer.data[idx + 0] = 0;
			this.framebuffer.data[idx + 1] = 0;
			this.framebuffer.data[idx + 2] = 0;
			this.framebuffer.data[idx + 3] = 0;
		}
	}
};

jsRaster.Rasterizer.prototype.render = function(attributes, attributeNames, uniforms, uniformNames, vertexCallback, pixelCallback) {
	var i;
	var that = this;
	if (! (this instanceof jsRaster.Rasterizer)) {
		throw "Something weird is going on. \"this\" does not point to a Rasterizer instance!";
	}
	/* Transform and manipulate the vertex attributes and get back a copy */
	this.attributes = attributes.map(function(attrib){ return vertexCallback(attrib, uniforms); });
	this.attributeNames = attributeNames;
	this.uniforms = uniforms;
	this.uniformNames = uniformNames;

	/* Do some sanity checking of the vertex data if exceptions are enabled. Otherwise, skip this for performance. */
	if(this.exceptionsEnabled){		
		if(this.attributeNames.length === 0){
			throw "Rasterizer: AttributeNames array is empty. A set of vertices is required.";
		}
		if(this.attributes.length < 3){
			throw "Rasterizer: Not enough data for a whole triangle!";
		}
		if((this.attributes.length % 3) !== 0){
			throw "Rasterizer: The number of vertices must be a multiple of 3.";
		}
		this.attributes.forEach(function(v){
			if(v["jsRasterPosition"] === undefined){
				throw "Found vertex without a jsRasterPosition! This special 4D vector attribute must be written by the vertex shader.";
			}
			attributeNames.forEach(function(p){
				if(v[p] === undefined || v[p] === null){
					throw "At least one vertex has an attribute which is undefined or null. Check your attribute and attributeNames arrays.";
				}
				if(!(v[p] instanceof Float32Array) && !(v[p] instanceof Array) && typeof(v[p]).toLowerCase() !== "number"){
					throw "At least one vertex has an attribute which is of the wrong type! (Array, Float32Array or Number expected)";
				}
			});
		});
	}

	/* Perform clipping */
	this.clipping();
	/* Project vertices and compute coefficient 3x3 matrix for each triangle */
	this.computecoeffs();
	//this.context.clearRect(0, 0, this.width, this.height);
	this.rasterize(pixelCallback);
};


