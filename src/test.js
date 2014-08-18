var vertexShader = function(attribute, uniforms){	
	var v = vec4.fromValues(
		attribute.vertex[0],
		attribute.vertex[1],
		attribute.vertex[2],
		1.0
	);

	vec4.transformMat4(v, v, uniforms.modelviewMatrix);
	v[2] -= 4.0;
	vec4.transformMat4(v, v, uniforms.projectionMatrix);

	/* Important! Make a deep copy which the rasterizer can modify without touching the reference mesh data! */
	var retAttr = {
		vertex: new Float32Array(attribute.vertex),
		color: new Float32Array(attribute.color),
		jsRasterPosition: new Float32Array(v) //Must write this special property which represents the vertex positions!
	};
	
	return retAttr;
};

var fragmentShader = function(varyings, uniforms){
	var color = vec4.fromValues(varyings["color"][2], varyings["color"][2], varyings["color"][2], 1.0);
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
	mat4.perspective(persp, 90.0, 4/3, 1, 100);

	uniforms = {
		projectionMatrix: persp,
		modelviewMatrix: model
	};

	var redraw = function(){
		rot += 1.0/240.0;
		while(rot >= 1.0){
			rot -= 1.0;
		}
		mat4.identity(uniforms.modelviewMatrix);
		mat4.rotate(uniforms.modelviewMatrix, uniforms.modelviewMatrix, Math.PI*2.0*rot, [0, 1.0, 0]);
		r.clear();
		r.render(data, ["vertex", "color"], uniforms, ["projectionMatrix", "modelviewMatrix"], vertexShader, fragmentShader);
		r.flip();
		window.requestAnimationFrame(redraw);
	};

	window.requestAnimationFrame(redraw);
};
