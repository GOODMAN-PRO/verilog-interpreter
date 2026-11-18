module tb;
  reg [7:0] unknown, zvalue, known, zero;
  initial begin
    unknown = 8'b0000_x001;
    zvalue = 8'b0000_z001;
    known = 8'd6;
    zero = 0;
    $display("x_arith %h %h %h %h %h", unknown+known, unknown-known, unknown*known, unknown/known, unknown%known);
    $display("z_arith %h %h %h %h %h", zvalue+known, zvalue-known, zvalue*known, zvalue/known, zvalue%known);
    $display("zero_div %h %h %h %h", known/zero, known%zero, zero/zero, zero%zero);
    $display("zero_product %h %h", unknown*zero, zvalue*zero);
    $display("power_unknown %h %h %h %h", unknown**2, known**unknown, unknown**zero, zero**zero);
    $display("power_negative %0d %0d %0d", 2**(-2), (-1)**(-3), 0**(-1));
    $display("unary_unknown %h %h %h %h", +unknown, -unknown, +zvalue, -zvalue);
    $finish;
  end
endmodule
