module tb;
  reg [7:0] value;
  reg [7:0] memory [0:1];
  integer index;
  initial begin
    value = 8'ha5;
    memory[0] = 8'h12;
    memory[1] = 8'h34;
    index = -1;
    $display("negative %b %b %h", value[index], value[index +: 4], memory[index]);
    index = 7;
    $display("partial %b %b", value[index +: 4], value[index -: 4]);
    value[index +: 4] = 4'b0010;
    $display("partial_write %h", value);
    index = 12;
    $display("outside %b %b %h", value[index], value[index -: 4], memory[index]);
    value[index] = 1'b1;
    index = 32'bx;
    $display("unknown %b %b %h", value[index], value[index +: 4], memory[index]);
    value[index +: 4] = 4'hf;
    memory[index] = 8'hff;
    $display("unchanged %h %h %h", value, memory[0], memory[1]);
    $finish;
  end
endmodule
