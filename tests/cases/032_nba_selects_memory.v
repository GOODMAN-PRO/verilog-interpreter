module tb;
  reg [7:0] value;
  reg [7:0] mem [0:2];
  integer i;
  initial begin
    value = 8'hff;
    mem[0] = 8'h10;
    mem[1] = 8'h20;
    mem[2] = 8'h30;
    i = 0;
    #1;
    value <= 8'h00;
    value[3:0] <= 4'ha;
    value[7:4] <= 4'hb;
    value[1] <= 1'b0;
    mem[i] <= mem[1];
    i = 2;
    mem[i][3:0] <= 4'hd;
    mem[1][4 +: 4] <= 4'he;
    #1;
    $display("value=%h mem=%h,%h,%h index=%0d", value,
             mem[0], mem[1], mem[2], i);
    $finish;
  end
endmodule