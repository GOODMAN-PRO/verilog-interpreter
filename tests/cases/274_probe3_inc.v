module t;
  wire [7:0] w; wor [3:0] o; wire [199:0] big; reg [7:0] a; reg b; reg [199:0] v;
  genvar i;
  generate
    for (i = 0; i < 8; i = i + 1) begin : g assign w[i] = a[i]; end
    for (i = 0; i < 200; i = i + 1) begin : h assign big[i] = v[i] ^ v[199 - i]; end
  endgenerate
  assign w[3] = b; assign o = a[3:0]; assign o[1] = b; assign big[100] = b;
  initial begin
    a = 8'h5a; b = 1'bz; v = 200'd1 << 150; #1 $display("%b %b %h", w, o, big);
    b = 1; #1 $display("%b %b %h", w, o, big);
    a = 8'hff; b = 0; v = {25{8'ha5}}; #1 $display("%b %b %h", w, o, big);
    v[100] = 1'bx; #1 $display("%b %b %h", w, o, big);
  end
endmodule
