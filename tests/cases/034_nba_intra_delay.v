module tb;
  reg [7:0] value, source;
  reg [7:0] mem [0:2];
  integer index;
  initial begin
    source = 8'h31;
    value = 0;
    mem[0] = 0;
    mem[1] = 0;
    mem[2] = 0;
    index = 0;
    value <= #3 source;
    mem[index] <= #4 source;
    index = 1;
    mem[index][2 +: 4] <= #4 source[3:0];
    #1 source = 8'h72;
    index = 2;
    value <= #4 source;
    #1 $display("pending value=%h mem=%h,%h,%h", value, mem[0], mem[1], mem[2]);
    #2 $display("first value=%h", value);
    #2 $display("final value=%h mem=%h,%h,%h", value, mem[0], mem[1], mem[2]);
    $finish;
  end
endmodule