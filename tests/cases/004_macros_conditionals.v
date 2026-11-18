`define WIDTH 8
`define SUM(a,b) ((a) + (b))
`define SELECTED
module tb;
  reg [`WIDTH-1:0] value;
  initial begin
    value = `SUM(3, 4) * 2;
    $display("macro=%0d", value);
`ifdef SELECTED
    $display("ifdef selected");
`else
    $display("incorrect selected else");
`endif
`ifndef MISSING
    $display("ifndef missing");
`endif
`ifdef MISSING
    $display("incorrect first branch");
`elsif SELECTED
    $display("elsif selected");
`else
    $display("incorrect elsif else");
`endif
`ifdef MISSING
    $display("incorrect missing");
`else
  `ifndef MISSING
    $display("nested else");
  `endif
`endif
    $finish;
  end
endmodule
`undef WIDTH
`undef SUM
`undef SELECTED
