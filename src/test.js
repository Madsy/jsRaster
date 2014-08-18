var vertexShader = function(attribute, uniforms){
	//Write the output position
	//In a more elaborate example, it should be something like:
	//attribute["jsRasterPosition"] = vec4.transformMat3(attribute["vertex"], attribute["vertex"], uniforms.modelviewProjectionMatrix);
	
	var v = vec4.fromValues(
		attribute.vertex[0],
		attribute.vertex[1],
		attribute.vertex[2],
		1.0
	);

	vec4.transformMat4(v, v, uniforms.modelviewMatrix);
	v[2] -= 6.0;
	vec4.transformMat4(v, v, uniforms.projectionMatrix);
	//attribute["jsRasterPosition"] = v;

	/* Important! Make a deep copy which the rasterizer can modify without touching the reference mesh data! */
	var retAttr = {
		vertex: new Float32Array(attribute.vertex),
		color: new Float32Array(attribute.color),
		jsRasterPosition: new Float32Array(v)
	};
	
	return retAttr;
};

var fragmentShader = function(){
	var color = vec4.fromValues(0.0, 0.0, 1.0, 1.0);
	return color;
};

window.onload = function(){
	var Canvas, data, uniforms;
	var r;
	var rot = 0;

	Canvas = document.getElementById('canvas1');
	r = jsRaster.Rasterizer(Canvas, false);
	
	var v1 = vec3.fromValues(-0.9, -0.9, 0.0);
	var v2 = vec3.fromValues( 0.0,  0.9, 0.0);
	var v3 = vec3.fromValues( 0.9, -0.9, 0.0);

	var c1 = vec3.fromValues( 1.0,  0.0, 0.0);
	var c2 = vec3.fromValues( 0.0,  1.0, 0.0);
	var c3 = vec3.fromValues( 0.0,  0.0, 1.0);

	data = [
		{vertex: v1,
		 color:  c1},
		{vertex: v2,
		 color:  c2},
		{vertex: v3,
		 color:  c3}
	];

	var persp = mat4.create();
	var model = mat4.create();
	mat4.perspective(90.0, 4/3, 1, 100, persp );
	//mat4.rotate(model, model, Math.PI/4, [0, 1, 0]);

	uniforms = {
		projectionMatrix: persp,
		modelviewMatrix: model
	};

	var redraw = function(){
		rot += 1.0/60.0;
		while(rot >= 1.0){
			rot -= 1.0;
		}
		mat4.identity(uniforms.modelviewMatrix);
		mat4.rotate(uniforms.modelviewMatrix, uniforms.modelviewMatrix, Math.PI*2.0*rot, [0, 1, 0]);
		r.clear();
		r.render(data, ["vertex", "color"], uniforms, ["projectionMatrix", "modelviewMatrix"], vertexShader, fragmentShader);
		r.flip();
		window.requestAnimationFrame(redraw);
	};

	window.requestAnimationFrame(redraw);
};
