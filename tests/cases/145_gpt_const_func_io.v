module top;
  function integer f(input integer n);
    begin $display("called"); f=n; end
  endfunction
  localparam P=f(2);
  initial $display("%0d",P);
endmodule
